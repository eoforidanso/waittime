import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAudit, type AuditUser } from '../utils/auditLog';
import { v4 as uuidv4 } from 'uuid';
import type { Ticket, Counter, Nurse, Ambulance, ServiceType, TicketStatus, Priority, NurseRole, QueueStats, HandoverNote, EscalationEntry, EscalationSeverity, ShiftEntry, ShiftType, InpatientUnit, InpatientBed, InpatientBedStatus, InpatientPatient } from '../types';
import { SERVICE_PREFIXES } from '../types';
import { saveDailyRecord } from '../db/patientDB';

const LS_KEY = 'mediq_queue_state';
const LS_VERSION_KEY = 'mediq_state_version';
const STATE_VERSION = '3';  // bump when seed data changes
const FS_DOC = 'hospitals/default';  // Firestore document path

interface QueueState {
  tickets: Ticket[];
  counters: Counter[];
  ticketCounters: Record<string, number>;
  nurses: Nurse[];
  ambulances: Ambulance[];
  handoverNotes: HandoverNote[];
  escalationLog: EscalationEntry[];
  shifts: ShiftEntry[];
  inpatientUnits: InpatientUnit[];
}

type QueueAction =
  | { type: 'ADD_TICKET'; payload: { patientName: string; age?: number; service: ServiceType; priority: Priority; notes?: string } }
  | { type: 'CALL_NEXT'; payload: { counterId: number } }
  | { type: 'COMPLETE_TICKET'; payload: { ticketId: string } }
  | { type: 'NO_SHOW'; payload: { ticketId: string } }
  | { type: 'MARK_DECEASED'; payload: { ticketId: string } }
  | { type: 'RECALL_TICKET'; payload: { ticketId: string; counterId: number } }
  | { type: 'ADMIT_TO_BAY'; payload: { patientName: string; age?: number; service: ServiceType; priority: Priority; notes?: string; chiefComplaint?: string; counterId: number } }
  | { type: 'UPDATE_TICKET_STATUS'; payload: { ticketId: string; status: TicketStatus } }
  | { type: 'ADD_COUNTER'; payload: { name: string; service: ServiceType; beds: number } }
  | { type: 'TOGGLE_COUNTER'; payload: { counterId: number } }
  | { type: 'TRANSFER_TICKET'; payload: { ticketId: string; newService: ServiceType } }
  | { type: 'UPDATE_BEDS'; payload: { counterId: number; bedsOccupied: number } }
  | { type: 'ADD_NURSE'; payload: { name: string; assignedArea: ServiceType | 'Triage'; role: NurseRole } }
  | { type: 'REMOVE_NURSE'; payload: { nurseId: string } }
  | { type: 'TOGGLE_NURSE_DUTY'; payload: { nurseId: string } }
  | { type: 'REASSIGN_NURSE'; payload: { nurseId: string; assignedArea: ServiceType | 'Triage' } }
  | { type: 'END_OF_DAY' }
  | { type: 'ADD_AMBULANCE'; payload: { unitNumber: string; patientName: string; sex?: string; age?: number; chiefComplaint: string; priority: Priority; eta: number; notes?: string; lat?: number; lng?: number } }
  | { type: 'UPDATE_AMBULANCE_LOCATION'; payload: { ambulanceId: string; lat: number; lng: number } }
  | { type: 'AMBULANCE_ARRIVED'; payload: { ambulanceId: string } }
  | { type: 'CANCEL_AMBULANCE'; payload: { ambulanceId: string } }
  | { type: 'SYNC_STATE'; payload: QueueState }
  | { type: 'ADD_HANDOVER_NOTE'; payload: { area: HandoverNote['area']; author: string; content: string; shift: HandoverNote['shift'] } }
  | { type: 'REMOVE_HANDOVER_NOTE'; payload: { noteId: string } }
  | { type: 'TOGGLE_HANDOVER_PIN'; payload: { noteId: string } }
  | { type: 'ADD_ESCALATION'; payload: { title: string; details: string; severity: EscalationSeverity; author: string; area: EscalationEntry['area'] } }
  | { type: 'RESOLVE_ESCALATION'; payload: { entryId: string } }
  | { type: 'REMOVE_ESCALATION'; payload: { entryId: string } }
  | { type: 'ADD_SHIFT'; payload: { nurseId: string; nurseName: string; nurseRole: NurseRole; date: string; shift: ShiftType; area: ShiftEntry['area']; notes?: string } }
  | { type: 'REMOVE_SHIFT'; payload: { shiftId: string } }
  | { type: 'UPDATE_TICKET_STATUS_FULL'; payload: { ticketId: string; status: TicketStatus } }
  | { type: 'ADMIT_TO_INPATIENT'; payload: { unitId: string; bedId: string; name: string; age?: number; admittedFrom: 'ER' | 'Direct'; erTicketId?: string; diagnosis?: string; notes?: string } }
  | { type: 'DISCHARGE_INPATIENT'; payload: { unitId: string; bedId: string } }
  | { type: 'TRANSFER_INPATIENT_BED'; payload: { fromUnitId: string; fromBedId: string; toUnitId: string; toBedId: string } }
  | { type: 'UPDATE_INPATIENT_BED_STATUS'; payload: { unitId: string; bedId: string; status: InpatientBedStatus } }
  | { type: 'ADD_INPATIENT_UNIT'; payload: { id: string; name: string; abbreviation: string; color: string; bedCount: number } }
  | { type: 'EDIT_INPATIENT_UNIT'; payload: { unitId: string; name: string; abbreviation: string; color: string } }
  | { type: 'DELETE_INPATIENT_UNIT'; payload: { unitId: string } }
  | { type: 'ADD_INPATIENT_BEDS'; payload: { unitId: string; count: number } };

// ── Mock seed helpers ──────────────────────────────────────────────────────
const ago = (min: number) => new Date(Date.now() - min * 60_000);

function makeTicket(
  id: string,
  ticketNumber: string,
  patientName: string,
  age: number,
  service: ServiceType,
  priority: Priority,
  counterNumber: number,
  chiefComplaint: string,
  arrivedMinsAgo: number,
): Ticket {
  return {
    id,
    ticketNumber,
    patientName,
    age,
    service,
    priority,
    status: 'serving',
    createdAt: ago(arrivedMinsAgo),
    triagedAt: ago(arrivedMinsAgo - 3),
    calledAt: ago(arrivedMinsAgo - 8),
    estimatedWait: 0,
    counterNumber,
    chiefComplaint,
  };
}

// Bay 1 – Resuscitation (4 beds, critical)
const t_rs1 = makeTicket('rs1','RS-001','Owusu, K.',45,'Resuscitation','critical',1,'Cardiac arrest',185);
const t_rs2 = makeTicket('rs2','RS-002','Amponsah, A.',67,'Resuscitation','critical',1,'Acute stroke',162);
const t_rs3 = makeTicket('rs3','RS-003','Boateng, S.',32,'Resuscitation','critical',1,'Severe polytrauma',140);
// Bay 2 – Trauma (6 beds, critical/emergent)
const t_tr1 = makeTicket('tr1','TR-001','Mensah, E.',28,'Trauma','critical',2,'MVA – polytrauma',175);
const t_tr2 = makeTicket('tr2','TR-002','Asante, J.',41,'Trauma','critical',2,'Gunshot wound',155);
const t_tr3 = makeTicket('tr3','TR-003','Darko, F.',55,'Trauma','emergent',2,'Fall from height',130);
const t_tr4 = makeTicket('tr4','TR-004','Osei, P.',22,'Trauma','emergent',2,'Burns 30%',110);
// Bay 3 – Acute Care (10 beds, emergent/urgent)
const t_ac1  = makeTicket('ac01','AC-001','Frimpong, Y.',52,'Acute Care','emergent',3,'Chest pain',200);
const t_ac2  = makeTicket('ac02','AC-002','Antwi, D.',35,'Acute Care','emergent',3,'Acute abdomen',185);
const t_ac3  = makeTicket('ac03','AC-003','Kyei, R.',61,'Acute Care','emergent',3,'COPD exacerbation',170);
const t_ac4  = makeTicket('ac04','AC-004','Appiah, N.',44,'Acute Care','emergent',3,'Diabetic ketoacidosis',155);
const t_ac5  = makeTicket('ac05','AC-005','Baidoo, T.',29,'Acute Care','emergent',3,'Sepsis',140);
const t_ac6  = makeTicket('ac06','AC-006','Danso, G.',72,'Acute Care','urgent',3,'Heart failure',125);
const t_ac7  = makeTicket('ac07','AC-007','Bonsu, H.',19,'Acute Care','urgent',3,'Anaphylaxis',110);
// Bay 4 – Acute Care (8 beds, urgent)
const t_ac11 = makeTicket('ac11','AC-011','Ofori, V.',40,'Acute Care','urgent',4,'Pneumonia',190);
const t_ac12 = makeTicket('ac12','AC-012','Armah, Q.',27,'Acute Care','urgent',4,'Renal colic',175);
const t_ac13 = makeTicket('ac13','AC-013','Inkoom, Z.',65,'Acute Care','urgent',4,'UTI with sepsis',160);
const t_ac14 = makeTicket('ac14','AC-014','Quartey, A.',50,'Acute Care','urgent',4,'Severe cellulitis',145);
const t_ac15 = makeTicket('ac15','AC-015','Asiedu, I.',31,'Acute Care','urgent',4,'Status migrainosus',130);
// Bay 5 – Fast Track (6 beds, urgent/non-urgent)
const t_ft1 = makeTicket('ft1','FT-001','Quaye, C.',39,'Fast Track','urgent',5,'Laceration repair',150);
const t_ft2 = makeTicket('ft2','FT-002','Siaw, D.',22,'Fast Track','urgent',5,'Ankle sprain',130);
const t_ft3 = makeTicket('ft3','FT-003','Poku, E.',55,'Fast Track','non-urgent',5,'Ear infection',110);
const t_ft4 = makeTicket('ft4','FT-004','Acheampong, F.',18,'Fast Track','non-urgent',5,'Allergic rash',90);
// Bay 6 – Pediatric ER (5 beds, emergent/urgent)
const t_pd1 = makeTicket('pd1','PD-001','Ababio, J.',3,'Pediatric ER','emergent',6,'High fever – seizure',145);
const t_pd2 = makeTicket('pd2','PD-002','Asante, K.',7,'Pediatric ER','emergent',6,'Asthma attack',125);
const t_pd3 = makeTicket('pd3','PD-003','Boakye, L.',5,'Pediatric ER','urgent',6,'Vomiting / dehydration',105);
// Bay 7 – Observation (8 beds, urgent/non-urgent)
const t_ob1 = makeTicket('ob1','OB-001','Ennin, O.',62,'Observation','urgent',7,'Post-procedure monitoring',210);
const t_ob2 = makeTicket('ob2','OB-002','Fianko, P.',71,'Observation','urgent',7,'Syncope workup',195);
const t_ob3 = makeTicket('ob3','OB-003','Gyimah, Q.',45,'Observation','urgent',7,'Chest pain – obs',180);
const t_ob4 = makeTicket('ob4','OB-004','Hayfron, R.',38,'Observation','urgent',7,'Head injury – obs',160);
const t_ob5 = makeTicket('ob5','OB-005','Inkoom, S.',55,'Observation','urgent',7,'Overdose monitoring',140);

// ── Waiting patients (triaged, awaiting bay assignment) ──
function makeWaitingTicket(
  id: string, ticketNumber: string, patientName: string, age: number,
  service: ServiceType, priority: Priority, chiefComplaint: string, arrivedMinsAgo: number,
): Ticket {
  return {
    id, ticketNumber, patientName, age, service, priority,
    status: 'waiting',
    createdAt: ago(arrivedMinsAgo),
    triagedAt: ago(arrivedMinsAgo - 3),
    estimatedWait: 15,
    chiefComplaint,
  };
}
const t_w1 = makeWaitingTicket('w1','RS-005','Ankomah, P.',63,'Resuscitation','critical','Cardiac arrest',10);
const t_w2 = makeWaitingTicket('w2','TR-007','Asamoah, K.',30,'Trauma','emergent','Penetrating chest wound',25);
const t_w3 = makeWaitingTicket('w3','AC-019','Gyasi, L.',57,'Acute Care','urgent','Severe headache',35);
const t_w4 = makeWaitingTicket('w4','AC-020','Mensah, B.',42,'Acute Care','emergent','Acute chest pain',20);
const t_w5 = makeWaitingTicket('w5','FT-007','Addai, N.',26,'Fast Track','non-urgent','Wrist injury',40);
const t_w6 = makeWaitingTicket('w6','FT-008','Koranteng, S.',33,'Fast Track','urgent','Laceration – scalp',15);
const t_w7 = makeWaitingTicket('w7','PD-006','Owusu, T.',4,'Pediatric ER','urgent','High fever',30);
const t_w8 = makeWaitingTicket('w8','OB-009','Fosu, C.',48,'Observation','urgent','Chest pain – rule out',45);

const initialTickets: Ticket[] = [
  // Serving (in bays)
  t_rs1,t_rs2,t_rs3,
  t_tr1,t_tr2,t_tr3,t_tr4,
  t_ac1,t_ac2,t_ac3,t_ac4,t_ac5,t_ac6,t_ac7,
  t_ac11,t_ac12,t_ac13,t_ac14,t_ac15,
  t_ft1,t_ft2,t_ft3,t_ft4,
  t_pd1,t_pd2,t_pd3,
  t_ob1,t_ob2,t_ob3,t_ob4,t_ob5,
  // Waiting (triaged, need bay assignment)
  t_w1,t_w2,t_w3,t_w4,t_w5,t_w6,t_w7,t_w8,
];

const initialCounters: Counter[] = [
  { id: 1, name: 'Bay 1', service: 'Resuscitation', isActive: true, beds: 4, bedsOccupied: 3, currentTicket: t_rs3 },
  { id: 2, name: 'Bay 2', service: 'Trauma',        isActive: true, beds: 6, bedsOccupied: 4, currentTicket: t_tr4 },
  { id: 3, name: 'Bay 3', service: 'Acute Care',    isActive: true, beds: 10, bedsOccupied: 7, currentTicket: t_ac7 },
  { id: 4, name: 'Bay 4', service: 'Acute Care',    isActive: true, beds: 8,  bedsOccupied: 5, currentTicket: t_ac15 },
  { id: 5, name: 'Bay 5', service: 'Fast Track',    isActive: true, beds: 6,  bedsOccupied: 4, currentTicket: t_ft4 },
  { id: 6, name: 'Bay 6', service: 'Pediatric ER',  isActive: true, beds: 5,  bedsOccupied: 3, currentTicket: t_pd3 },
  { id: 7, name: 'Bay 7', service: 'Observation',   isActive: true, beds: 8,  bedsOccupied: 5, currentTicket: t_ob5 },
];

const initialNurses: Nurse[] = [
  { id: '1', name: 'Ama Mensah', role: 'Charge Nurse', onDuty: true, assignedArea: 'Resuscitation' },
  { id: '2', name: 'Kwame Asante', role: 'Staff Nurse', onDuty: true, assignedArea: 'Resuscitation' },
  { id: '3', name: 'Abena Osei', role: 'Charge Nurse', onDuty: true, assignedArea: 'Trauma' },
  { id: '4', name: 'Kofi Boateng', role: 'Staff Nurse', onDuty: true, assignedArea: 'Trauma' },
  { id: '5', name: 'Akua Adjei', role: 'Charge Nurse', onDuty: true, assignedArea: 'Acute Care' },
  { id: '6', name: 'Yaw Owusu', role: 'Staff Nurse', onDuty: true, assignedArea: 'Acute Care' },
  { id: '7', name: 'Efua Darko', role: 'Staff Nurse', onDuty: true, assignedArea: 'Acute Care' },
  { id: '8', name: 'Kwesi Agyemang', role: 'Charge Nurse', onDuty: true, assignedArea: 'Fast Track' },
  { id: '9', name: 'Adwoa Amponsah', role: 'Staff Nurse', onDuty: true, assignedArea: 'Fast Track' },
  { id: '10', name: 'Afia Bonsu', role: 'Charge Nurse', onDuty: true, assignedArea: 'Pediatric ER' },
  { id: '11', name: 'Kojo Frimpong', role: 'Staff Nurse', onDuty: true, assignedArea: 'Pediatric ER' },
  { id: '12', name: 'Akosua Tetteh', role: 'Charge Nurse', onDuty: true, assignedArea: 'Observation' },
  { id: '13', name: 'Nana Adu', role: 'Staff Nurse', onDuty: true, assignedArea: 'Observation' },
  { id: '14', name: 'Yaa Antwi', role: 'Charge Nurse', onDuty: true, assignedArea: 'Triage' },
  { id: '15', name: 'Kwaku Appiah', role: 'Staff Nurse', onDuty: true, assignedArea: 'Triage' },
  { id: '16', name: 'Esi Baidoo', role: 'Staff Nurse', onDuty: true, assignedArea: 'Triage' },
  { id: '17', name: 'Nii Armah', role: 'Staff Nurse', onDuty: false, assignedArea: 'Trauma' },
  { id: '18', name: 'Naana Ofori', role: 'Staff Nurse', onDuty: false, assignedArea: 'Acute Care' },
  { id: '19', name: 'Fiifi Mensah', role: 'Staff Nurse', onDuty: false, assignedArea: 'Fast Track' },
  { id: '20', name: 'Maame Serwaa', role: 'Staff Nurse', onDuty: false, assignedArea: 'Resuscitation' },
  { id: '21', name: 'Paa Kwesi Yankah', role: 'Staff Nurse', onDuty: false, assignedArea: 'Pediatric ER' },
  { id: '22', name: 'Adjoa Kyei', role: 'Staff Nurse', onDuty: false, assignedArea: 'Observation' },
  { id: '23', name: 'Kwabena Danso', role: 'Staff Nurse', onDuty: false, assignedArea: 'Triage' },
  { id: '24', name: 'Akosua Amoako', role: 'Staff Nurse', onDuty: false, assignedArea: 'Acute Care' },
  // Physicians & Physician Assistants
  { id: '25', name: 'Dr. Kofi Asante', role: 'Attending Physician', onDuty: true, assignedArea: 'Resuscitation' },
  { id: '26', name: 'Dr. Abena Mensah', role: 'Attending Physician', onDuty: true, assignedArea: 'Trauma' },
  { id: '27', name: 'Dr. Yaw Boateng', role: 'Attending Physician', onDuty: true, assignedArea: 'Acute Care' },
  { id: '28', name: 'Dr. Ama Darko', role: 'Attending Physician', onDuty: true, assignedArea: 'Pediatric ER' },
  { id: '29', name: 'Dr. Kwesi Ofori', role: 'Attending Physician', onDuty: false, assignedArea: 'Fast Track' },
  { id: '30', name: 'Adjoa Antwi', role: 'Physician Assistant', onDuty: true, assignedArea: 'Acute Care' },
  { id: '31', name: 'Kofi Acheampong', role: 'Physician Assistant', onDuty: true, assignedArea: 'Fast Track' },
  { id: '32', name: 'Efua Owusu', role: 'Physician Assistant', onDuty: false, assignedArea: 'Observation' },
];

// ── Inpatient seed helpers ─────────────────────────────────────────────────
function makeBeds(unitId: string, abbr: string, count: number, occupiedPatients: { name: string; age: number; diagnosis: string; hoursAgo: number }[]): InpatientBed[] {
  return Array.from({ length: count }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    const bedId = `${unitId}-B${num}`;
    const p = occupiedPatients[i];
    if (p) {
      return {
        id: bedId,
        bedNumber: `${abbr}-${num}`,
        status: 'occupied' as InpatientBedStatus,
        patient: {
          id: uuidv4(),
          name: p.name,
          age: p.age,
          admittedAt: new Date(Date.now() - p.hoursAgo * 3_600_000),
          admittedFrom: 'ER' as const,
          diagnosis: p.diagnosis,
        },
      };
    }
    const statusList: InpatientBedStatus[] = ['available', 'available', 'available', 'cleaning', 'available'];
    return { id: bedId, bedNumber: `${abbr}-${num}`, status: statusList[i % statusList.length] };
  });
}

const initialInpatientUnits: InpatientUnit[] = [
  {
    id: 'icu',
    name: 'Intensive Care Unit',
    abbreviation: 'ICU',
    color: '#dc2626',
    beds: makeBeds('icu', 'ICU', 12, [
      { name: 'Asante, K.', age: 67, diagnosis: 'Respiratory failure – ventilated', hoursAgo: 48 },
      { name: 'Mensah, E.', age: 45, diagnosis: 'Post-cardiac arrest care', hoursAgo: 30 },
      { name: 'Boateng, S.', age: 72, diagnosis: 'Severe sepsis', hoursAgo: 24 },
      { name: 'Frimpong, A.', age: 58, diagnosis: 'Traumatic brain injury', hoursAgo: 72 },
      { name: 'Osei, P.', age: 61, diagnosis: 'ARDS – COVID-19', hoursAgo: 56 },
      { name: 'Antwi, D.', age: 50, diagnosis: 'Multi-organ failure', hoursAgo: 18 },
      { name: 'Darko, Y.', age: 39, diagnosis: 'Post-op liver resection', hoursAgo: 8 },
      { name: 'Amponsah, R.', age: 55, diagnosis: 'DKA with sepsis', hoursAgo: 12 },
      { name: 'Owusu, C.', age: 44, diagnosis: 'Cardiogenic shock', hoursAgo: 36 },
    ]),
  },
  {
    id: 'ccu',
    name: 'Cardiac Care Unit',
    abbreviation: 'CCU',
    color: '#ef4444',
    beds: makeBeds('ccu', 'CCU', 8, [
      { name: 'Quaye, F.', age: 63, diagnosis: 'STEMI – post-PCI', hoursAgo: 24 },
      { name: 'Adjei, G.', age: 71, diagnosis: 'Acute heart failure', hoursAgo: 36 },
      { name: 'Bonsu, H.', age: 55, diagnosis: 'Unstable angina', hoursAgo: 18 },
      { name: 'Siaw, M.', age: 68, diagnosis: 'Ventricular tachycardia', hoursAgo: 12 },
      { name: 'Inkoom, N.', age: 74, diagnosis: 'Aortic stenosis pre-TAVR', hoursAgo: 48 },
    ]),
  },
  {
    id: 'mwa',
    name: 'Medical Ward A',
    abbreviation: 'MW-A',
    color: '#f59e0b',
    beds: makeBeds('mwa', 'MW-A', 20, [
      { name: 'Poku, J.', age: 48, diagnosis: 'Pneumonia', hoursAgo: 36 },
      { name: 'Ababio, L.', age: 65, diagnosis: 'COPD exacerbation', hoursAgo: 24 },
      { name: 'Kyei, T.', age: 52, diagnosis: 'UTI with sepsis', hoursAgo: 18 },
      { name: 'Asiedu, B.', age: 41, diagnosis: 'Acute pancreatitis', hoursAgo: 48 },
      { name: 'Armah, C.', age: 70, diagnosis: 'Stroke – ischaemic', hoursAgo: 60 },
      { name: 'Quartey, D.', age: 35, diagnosis: 'Diabetic ketoacidosis', hoursAgo: 12 },
      { name: 'Tetteh, E.', age: 58, diagnosis: 'Pulmonary embolism', hoursAgo: 30 },
      { name: 'Ofori, M.', age: 62, diagnosis: 'Hypertensive emergency', hoursAgo: 22 },
      { name: 'Fosu, K.', age: 44, diagnosis: 'Upper GI bleed', hoursAgo: 14 },
      { name: 'Adu, N.', age: 33, diagnosis: 'Sickle cell crisis', hoursAgo: 40 },
      { name: 'Ankomah, S.', age: 76, diagnosis: 'Decompensated cirrhosis', hoursAgo: 28 },
      { name: 'Baidoo, R.', age: 29, diagnosis: 'Anaphylaxis – recovery', hoursAgo: 8 },
      { name: 'Fianko, W.', age: 55, diagnosis: 'Acute kidney injury', hoursAgo: 20 },
      { name: 'Gyimah, P.', age: 67, diagnosis: 'Community-acquired pneumonia', hoursAgo: 45 },
      { name: 'Hayfron, A.', age: 49, diagnosis: 'Meningitis – bacterial', hoursAgo: 16 },
    ]),
  },
  {
    id: 'mwb',
    name: 'Medical Ward B',
    abbreviation: 'MW-B',
    color: '#10b981',
    beds: makeBeds('mwb', 'MW-B', 20, [
      { name: 'Danso, K.', age: 53, diagnosis: 'Cellulitis', hoursAgo: 24 },
      { name: 'Amoako, J.', age: 39, diagnosis: 'Epilepsy – status', hoursAgo: 18 },
      { name: 'Appiah, T.', age: 61, diagnosis: 'GI infection – C. diff', hoursAgo: 36 },
      { name: 'Ennin, S.', age: 47, diagnosis: 'Hepatitis – acute', hoursAgo: 48 },
      { name: 'Yankah, B.', age: 58, diagnosis: 'Asthma – severe', hoursAgo: 12 },
      { name: 'Serwaa, O.', age: 71, diagnosis: 'Falls – fracture NOF', hoursAgo: 30 },
      { name: 'Kwesi, A.', age: 44, diagnosis: 'Thyroid storm', hoursAgo: 22 },
      { name: 'Addai, G.', age: 38, diagnosis: 'Drug overdose – recovery', hoursAgo: 10 },
      { name: 'Koranteng, H.', age: 66, diagnosis: 'Renal colic', hoursAgo: 14 },
      { name: 'Owusu, V.', age: 55, diagnosis: 'Lung cancer – effusion', hoursAgo: 60 },
      { name: 'Acheampong, F.', age: 29, diagnosis: 'Inflammatory bowel disease', hoursAgo: 40 },
      { name: 'Asante, Q.', age: 72, diagnosis: 'Heart failure – new onset', hoursAgo: 26 },
    ]),
  },
  {
    id: 'swa',
    name: 'Surgical Ward',
    abbreviation: 'SWA',
    color: '#8b5cf6',
    beds: makeBeds('swa', 'SWA', 16, [
      { name: 'Mensah, B.', age: 42, diagnosis: 'Post-appendicectomy', hoursAgo: 24 },
      { name: 'Darko, C.', age: 60, diagnosis: 'Post-bowel resection', hoursAgo: 48 },
      { name: 'Boateng, E.', age: 38, diagnosis: 'Laparoscopic cholecystectomy', hoursAgo: 12 },
      { name: 'Osei, F.', age: 55, diagnosis: 'Hernia repair – post-op', hoursAgo: 8 },
      { name: 'Frimpong, G.', age: 63, diagnosis: 'Colostomy formation', hoursAgo: 36 },
      { name: 'Antwi, H.', age: 47, diagnosis: 'Splenectomy – trauma', hoursAgo: 60 },
      { name: 'Ofori, J.', age: 51, diagnosis: 'Abdominal aortic repair', hoursAgo: 72 },
      { name: 'Tetteh, K.', age: 35, diagnosis: 'Thyroidectomy – post-op', hoursAgo: 18 },
      { name: 'Baidoo, L.', age: 66, diagnosis: 'Mastectomy – post-op', hoursAgo: 30 },
      { name: 'Kyei, M.', age: 44, diagnosis: 'Bowel obstruction – lysis', hoursAgo: 22 },
    ]),
  },
  {
    id: 'pwa',
    name: 'Paediatrics Ward',
    abbreviation: 'PED',
    color: '#3b82f6',
    beds: makeBeds('pwa', 'PED', 14, [
      { name: 'Asante, T.', age: 5, diagnosis: 'Febrile convulsion', hoursAgo: 18 },
      { name: 'Mensah, U.', age: 8, diagnosis: 'Asthma attack', hoursAgo: 24 },
      { name: 'Boateng, V.', age: 3, diagnosis: 'Severe dehydration', hoursAgo: 12 },
      { name: 'Osei, W.', age: 10, diagnosis: 'Sickle cell crisis', hoursAgo: 36 },
      { name: 'Darko, X.', age: 2, diagnosis: 'Pneumonia', hoursAgo: 48 },
      { name: 'Frimpong, Y.', age: 7, diagnosis: 'Appendicitis – post-op', hoursAgo: 22 },
      { name: 'Antwi, Z.', age: 4, diagnosis: 'Bronchiolitis', hoursAgo: 16 },
      { name: 'Kyei, A.', age: 9, diagnosis: 'Diabetic ketoacidosis', hoursAgo: 30 },
    ]),
  },
  {
    id: 'orth',
    name: 'Orthopaedics Ward',
    abbreviation: 'ORT',
    color: '#06b6d4',
    beds: makeBeds('orth', 'ORT', 12, [
      { name: 'Quaye, B.', age: 74, diagnosis: 'NOF fracture – post-THR', hoursAgo: 36 },
      { name: 'Adjei, C.', age: 58, diagnosis: 'Knee replacement – recovery', hoursAgo: 24 },
      { name: 'Bonsu, D.', age: 65, diagnosis: 'Spinal cord compression', hoursAgo: 48 },
      { name: 'Siaw, E.', age: 42, diagnosis: 'Tibial fracture – ORIF', hoursAgo: 18 },
      { name: 'Poku, F.', age: 50, diagnosis: 'Humerus fracture – post-op', hoursAgo: 12 },
      { name: 'Ababio, G.', age: 61, diagnosis: 'Hip revision surgery', hoursAgo: 30 },
      { name: 'Armah, H.', age: 38, diagnosis: 'Pelvis fracture – fixation', hoursAgo: 60 },
    ]),
  },
];

const initialState: QueueState = {
  tickets: initialTickets,
  counters: initialCounters,
  ticketCounters: { RS: 5, TR: 7, AC: 20, FT: 8, PD: 6, OB: 9 },
  nurses: initialNurses,
  ambulances: [],
  handoverNotes: [],
  escalationLog: [],
  shifts: [],
  inpatientUnits: initialInpatientUnits,
};

function generateTicketNumber(service: ServiceType, counters: Record<string, number>): { number: string; updatedCounters: Record<string, number> } {
  const prefix = SERVICE_PREFIXES[service];
  const current = counters[prefix] || 0;
  const next = current + 1;
  return {
    number: `${prefix}-${String(next).padStart(3, '0')}`,
    updatedCounters: { ...counters, [prefix]: next },
  };
}

function estimateWaitTime(tickets: Ticket[], service: ServiceType): number {
  const waiting = tickets.filter(t => t.service === service && t.status === 'waiting');
  return Math.max(5, waiting.length * 8); // ~8 min per patient
}

function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'ADD_TICKET': {
      const { patientName, age, service, priority, notes } = action.payload;
      const { number, updatedCounters } = generateTicketNumber(service, state.ticketCounters);
      const newTicket: Ticket = {
        id: uuidv4(),
        ticketNumber: number,
        patientName,
        age,
        service,
        priority,
        status: 'waiting',
        createdAt: new Date(),
        triagedAt: new Date(),
        estimatedWait: estimateWaitTime(state.tickets, service),
        notes,
      };
      return {
        ...state,
        tickets: [...state.tickets, newTicket],
        ticketCounters: updatedCounters,
      };
    }

    case 'CALL_NEXT': {
      const { counterId } = action.payload;
      const counter = state.counters.find(c => c.id === counterId);
      if (!counter || !counter.isActive) return state;

      const waitingTickets = state.tickets
        .filter(t => t.service === counter.service && t.status === 'waiting')
        .sort((a, b) => {
          const priorityOrder: Record<Priority, number> = { critical: 0, emergent: 1, urgent: 2, 'non-urgent': 3 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      const nextTicket = waitingTickets[0];
      if (!nextTicket) return state;

      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === nextTicket.id
            ? { ...t, status: 'serving' as TicketStatus, calledAt: new Date(), counterNumber: counterId }
            : t
        ),
        counters: state.counters.map(c =>
          c.id === counterId
            ? { ...c, currentTicket: { ...nextTicket, status: 'serving', calledAt: new Date(), counterNumber: counterId }, bedsOccupied: Math.min(c.bedsOccupied + 1, c.beds) }
            : c
        ),
      };
    }

    case 'COMPLETE_TICKET': {
      const { ticketId } = action.payload;
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId ? { ...t, status: 'completed' as TicketStatus, completedAt: new Date() } : t
        ),
        counters: state.counters.map(c =>
          c.currentTicket?.id === ticketId ? { ...c, currentTicket: undefined, bedsOccupied: Math.max(0, c.bedsOccupied - 1) } : c
        ),
      };
    }

    case 'NO_SHOW': {
      const { ticketId } = action.payload;
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId ? { ...t, status: 'no-show' as TicketStatus } : t
        ),
        counters: state.counters.map(c =>
          c.currentTicket?.id === ticketId ? { ...c, currentTicket: undefined, bedsOccupied: Math.max(0, c.bedsOccupied - 1) } : c
        ),
      };
    }

    case 'MARK_DECEASED': {
      const { ticketId } = action.payload;
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId ? { ...t, status: 'deceased' as TicketStatus, completedAt: new Date() } : t
        ),
        counters: state.counters.map(c =>
          c.currentTicket?.id === ticketId ? { ...c, currentTicket: undefined, bedsOccupied: Math.max(0, c.bedsOccupied - 1) } : c
        ),
      };
    }

    case 'ADMIT_TO_BAY': {
      const { patientName, age, service, priority, notes, chiefComplaint, counterId } = action.payload;
      const { number, updatedCounters } = generateTicketNumber(service, state.ticketCounters);
      const now = new Date();
      const newTicket: Ticket = {
        id: uuidv4(),
        ticketNumber: number,
        patientName,
        age,
        service,
        priority,
        status: 'serving',
        createdAt: now,
        triagedAt: now,
        calledAt: now,
        estimatedWait: 0,
        counterNumber: counterId,
        notes,
        chiefComplaint,
      };
      return {
        ...state,
        tickets: [...state.tickets, newTicket],
        ticketCounters: updatedCounters,
        counters: state.counters.map(c =>
          c.id === counterId
            ? { ...c, currentTicket: newTicket, bedsOccupied: Math.min(c.bedsOccupied + 1, c.beds) }
            : c
        ),
      };
    }

    case 'RECALL_TICKET': {
      const { ticketId, counterId } = action.payload;
      const ticket = state.tickets.find(t => t.id === ticketId);
      if (!ticket) return state;
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId
            ? { ...t, status: 'serving' as TicketStatus, calledAt: new Date(), counterNumber: counterId }
            : t
        ),
        counters: state.counters.map(c =>
          c.id === counterId
            ? { ...c, currentTicket: { ...ticket, status: 'serving', calledAt: new Date(), counterNumber: counterId } }
            : c
        ),
      };
    }

    case 'TRANSFER_TICKET': {
      const { ticketId, newService } = action.payload;
      const { number, updatedCounters } = generateTicketNumber(newService, state.ticketCounters);
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId
            ? { ...t, service: newService, ticketNumber: number, status: 'waiting' as TicketStatus, counterNumber: undefined, calledAt: undefined }
            : t
        ),
        counters: state.counters.map(c =>
          c.currentTicket?.id === ticketId ? { ...c, currentTicket: undefined } : c
        ),
        ticketCounters: updatedCounters,
      };
    }

    case 'ADD_COUNTER': {
      const maxId = Math.max(...state.counters.map(c => c.id), 0);
      const newCounter: Counter = {
        id: maxId + 1,
        name: action.payload.name,
        service: action.payload.service,
        isActive: true,
        beds: action.payload.beds,
        bedsOccupied: 0,
      };
      return { ...state, counters: [...state.counters, newCounter] };
    }

    case 'TOGGLE_COUNTER': {
      return {
        ...state,
        counters: state.counters.map(c =>
          c.id === action.payload.counterId ? { ...c, isActive: !c.isActive } : c
        ),
      };
    }

    case 'UPDATE_BEDS': {
      const { counterId, bedsOccupied } = action.payload;
      return {
        ...state,
        counters: state.counters.map(c =>
          c.id === counterId ? { ...c, bedsOccupied: Math.max(0, Math.min(bedsOccupied, c.beds)) } : c
        ),
      };
    }

    case 'ADD_NURSE': {
      const newNurse: Nurse = {
        id: uuidv4(),
        name: action.payload.name,
        role: action.payload.role,
        onDuty: true,
        assignedArea: action.payload.assignedArea,
      };
      return { ...state, nurses: [...state.nurses, newNurse] };
    }

    case 'REMOVE_NURSE': {
      return { ...state, nurses: state.nurses.filter(n => n.id !== action.payload.nurseId) };
    }

    case 'TOGGLE_NURSE_DUTY': {
      return {
        ...state,
        nurses: state.nurses.map(n =>
          n.id === action.payload.nurseId ? { ...n, onDuty: !n.onDuty } : n
        ),
      };
    }

    case 'REASSIGN_NURSE': {
      return {
        ...state,
        nurses: state.nurses.map(n =>
          n.id === action.payload.nurseId ? { ...n, assignedArea: action.payload.assignedArea } : n
        ),
      };
    }

    case 'END_OF_DAY': {
      return {
        ...state,
        tickets: [],
        ticketCounters: {},
        counters: state.counters.map(c => ({ ...c, currentTicket: undefined, bedsOccupied: 0 })),
        ambulances: [],
      };
    }

    case 'ADD_AMBULANCE': {
      const { unitNumber, patientName, sex, age, chiefComplaint, priority, eta, notes, lat, lng } = action.payload;
      const newAmb: Ambulance = {
        id: uuidv4(),
        unitNumber,
        patientName,
        sex,
        age,
        chiefComplaint,
        priority,
        eta,
        status: 'en-route',
        dispatchedAt: new Date(),
        notes,
        lat,
        lng,
        lastLocationUpdate: lat !== undefined ? new Date() : undefined,
      };
      return { ...state, ambulances: [...state.ambulances, newAmb] };
    }

    case 'UPDATE_AMBULANCE_LOCATION': {
      const { ambulanceId, lat, lng } = action.payload;
      return {
        ...state,
        ambulances: state.ambulances.map(a =>
          a.id === ambulanceId ? { ...a, lat, lng, lastLocationUpdate: new Date() } : a
        ),
      };
    }

    case 'AMBULANCE_ARRIVED': {
      const { ambulanceId } = action.payload;
      return {
        ...state,
        ambulances: state.ambulances.map(a =>
          a.id === ambulanceId ? { ...a, status: 'arrived' as const, arrivedAt: new Date() } : a
        ),
      };
    }

    case 'CANCEL_AMBULANCE': {
      const { ambulanceId } = action.payload;
      const amb = state.ambulances.find(a => a.id === ambulanceId);
      // Void any waiting pre-alert triage ticket created for this ambulance
      const updatedTickets = amb
        ? state.tickets.map(t =>
            t.status === 'waiting' &&
            t.patientName.startsWith('🚑 PRE-ALERT:') &&
            t.notes?.includes(`Unit: ${amb.unitNumber}`)
              ? { ...t, status: 'no-show' as const, completedAt: new Date() }
              : t
          )
        : state.tickets;
      return {
        ...state,
        ambulances: state.ambulances.map(a =>
          a.id === ambulanceId ? { ...a, status: 'cancelled' as const } : a
        ),
        tickets: updatedTickets,
      };
    }

    case 'SYNC_STATE':
      return action.payload;

    case 'UPDATE_TICKET_STATUS_FULL': {
      const { ticketId, status } = action.payload;
      const isTerminal = ['completed','discharged','admitted','referred','no-show','deceased'].includes(status);
      return {
        ...state,
        tickets: state.tickets.map(t =>
          t.id === ticketId
            ? { ...t, status, completedAt: isTerminal ? new Date() : t.completedAt }
            : t
        ),
        counters: isTerminal
          ? state.counters.map(c => c.currentTicket?.id === ticketId ? { ...c, currentTicket: undefined, bedsOccupied: Math.max(0, c.bedsOccupied - 1) } : c)
          : state.counters,
      };
    }

    case 'ADD_HANDOVER_NOTE': {
      const { area, author, content, shift } = action.payload;
      const note: HandoverNote = { id: uuidv4(), area, author, content, shift, createdAt: new Date(), pinned: false };
      return { ...state, handoverNotes: [note, ...state.handoverNotes] };
    }
    case 'REMOVE_HANDOVER_NOTE':
      return { ...state, handoverNotes: state.handoverNotes.filter(n => n.id !== action.payload.noteId) };
    case 'TOGGLE_HANDOVER_PIN':
      return { ...state, handoverNotes: state.handoverNotes.map(n => n.id === action.payload.noteId ? { ...n, pinned: !n.pinned } : n) };

    case 'ADD_ESCALATION': {
      const { title, details, severity, author, area } = action.payload;
      const entry: EscalationEntry = { id: uuidv4(), title, details, severity, author, area, createdAt: new Date(), resolved: false };
      return { ...state, escalationLog: [entry, ...state.escalationLog] };
    }
    case 'RESOLVE_ESCALATION':
      return { ...state, escalationLog: state.escalationLog.map(e => e.id === action.payload.entryId ? { ...e, resolved: true, resolvedAt: new Date() } : e) };
    case 'REMOVE_ESCALATION':
      return { ...state, escalationLog: state.escalationLog.filter(e => e.id !== action.payload.entryId) };

    case 'ADD_SHIFT': {
      const { nurseId, nurseName, nurseRole, date, shift, area, notes } = action.payload;
      const entry: ShiftEntry = { id: uuidv4(), nurseId, nurseName, nurseRole, date, shift, area, notes };
      return { ...state, shifts: [...state.shifts, entry] };
    }
    case 'REMOVE_SHIFT':
      return { ...state, shifts: state.shifts.filter(s => s.id !== action.payload.shiftId) };

    case 'ADMIT_TO_INPATIENT': {
      const { unitId, bedId, name, age, admittedFrom, erTicketId, diagnosis, notes } = action.payload;
      const patient: InpatientPatient = {
        id: uuidv4(),
        name,
        age,
        admittedAt: new Date(),
        admittedFrom,
        erTicketId,
        diagnosis,
        notes,
      };
      const updatedUnits = state.inpatientUnits.map(u =>
        u.id !== unitId ? u : {
          ...u,
          beds: u.beds.map(b =>
            b.id !== bedId ? b : { ...b, status: 'occupied' as InpatientBedStatus, patient }
          ),
        }
      );
      // If admitted from ER, mark the ER ticket as 'admitted'
      const updatedTickets = erTicketId
        ? state.tickets.map(t =>
            t.id === erTicketId
              ? { ...t, status: 'admitted' as TicketStatus, completedAt: new Date() }
              : t
          )
        : state.tickets;
      const updatedCounters = erTicketId
        ? state.counters.map(c =>
            c.currentTicket?.id === erTicketId
              ? { ...c, currentTicket: undefined, bedsOccupied: Math.max(0, c.bedsOccupied - 1) }
              : c
          )
        : state.counters;
      return { ...state, inpatientUnits: updatedUnits, tickets: updatedTickets, counters: updatedCounters };
    }

    case 'DISCHARGE_INPATIENT': {
      const { unitId, bedId } = action.payload;
      return {
        ...state,
        inpatientUnits: state.inpatientUnits.map(u =>
          u.id !== unitId ? u : {
            ...u,
            beds: u.beds.map(b =>
              b.id !== bedId ? b : { ...b, status: 'cleaning' as InpatientBedStatus, patient: undefined }
            ),
          }
        ),
      };
    }

    case 'TRANSFER_INPATIENT_BED': {
      const { fromUnitId, fromBedId, toUnitId, toBedId } = action.payload;
      let patient: InpatientPatient | undefined;
      const afterRemove = state.inpatientUnits.map(u => {
        if (u.id !== fromUnitId) return u;
        return {
          ...u,
          beds: u.beds.map(b => {
            if (b.id !== fromBedId) return b;
            patient = b.patient;
            return { ...b, status: 'cleaning' as InpatientBedStatus, patient: undefined };
          }),
        };
      });
      if (!patient) return state;
      const afterPlace = afterRemove.map(u => {
        if (u.id !== toUnitId) return u;
        return {
          ...u,
          beds: u.beds.map(b =>
            b.id !== toBedId ? b : { ...b, status: 'occupied' as InpatientBedStatus, patient }
          ),
        };
      });
      return { ...state, inpatientUnits: afterPlace };
    }

    case 'UPDATE_INPATIENT_BED_STATUS': {
      const { unitId, bedId, status } = action.payload;
      return {
        ...state,
        inpatientUnits: state.inpatientUnits.map(u =>
          u.id !== unitId ? u : {
            ...u,
            beds: u.beds.map(b =>
              b.id !== bedId ? b : { ...b, status, patient: status === 'available' || status === 'cleaning' ? undefined : b.patient }
            ),
          }
        ),
      };
    }

    case 'ADD_INPATIENT_UNIT': {
      const { id, name, abbreviation, color, bedCount } = action.payload;
      const beds: InpatientBed[] = Array.from({ length: bedCount }, (_, i) => ({
        id: `${id}-bed-${i + 1}`,
        bedNumber: `${abbreviation}-${i + 1}`,
        status: 'available' as InpatientBedStatus,
      }));
      const newUnit: InpatientUnit = { id, name, abbreviation, color, beds };
      return { ...state, inpatientUnits: [...state.inpatientUnits, newUnit] };
    }

    case 'EDIT_INPATIENT_UNIT': {
      const { unitId, name, abbreviation, color } = action.payload;
      return {
        ...state,
        inpatientUnits: state.inpatientUnits.map(u => {
          if (u.id !== unitId) return u;
          return {
            ...u, name, abbreviation, color,
            beds: u.beds.map(b => {
              const numPart = b.bedNumber.includes('-')
                ? b.bedNumber.substring(b.bedNumber.lastIndexOf('-'))
                : `-${b.bedNumber}`;
              return { ...b, bedNumber: `${abbreviation}${numPart}` };
            }),
          };
        }),
      };
    }

    case 'DELETE_INPATIENT_UNIT': {
      return { ...state, inpatientUnits: state.inpatientUnits.filter(u => u.id !== action.payload.unitId) };
    }

    case 'ADD_INPATIENT_BEDS': {
      const { unitId, count } = action.payload;
      return {
        ...state,
        inpatientUnits: state.inpatientUnits.map(u => {
          if (u.id !== unitId) return u;
          const start = u.beds.length + 1;
          const newBeds: InpatientBed[] = Array.from({ length: count }, (_, i) => ({
            id: `${unitId}-bed-${start + i}-${Date.now() + i}`,
            bedNumber: `${u.abbreviation}-${start + i}`,
            status: 'available' as InpatientBedStatus,
          }));
          return { ...u, beds: [...u.beds, ...newBeds] };
        }),
      };
    }

    default:
      return state;
  }
}

interface QueueContextType {
  state: QueueState;
  addTicket: (patientName: string, service: ServiceType, priority: Priority, notes?: string, age?: number) => void;
  admitToBay: (patientName: string, service: ServiceType, priority: Priority, counterId: number, notes?: string, age?: number, chiefComplaint?: string) => void;
  callNext: (counterId: number) => void;
  completeTicket: (ticketId: string) => void;
  noShow: (ticketId: string) => void;
  markDeceased: (ticketId: string) => void;
  recallTicket: (ticketId: string, counterId: number) => void;
  transferTicket: (ticketId: string, newService: ServiceType) => void;
  addCounter: (name: string, service: ServiceType, beds: number) => void;
  toggleCounter: (counterId: number) => void;
  updateBeds: (counterId: number, bedsOccupied: number) => void;
  addNurse: (name: string, assignedArea: ServiceType | 'Triage', role: NurseRole) => void;
  removeNurse: (nurseId: string) => void;
  toggleNurseDuty: (nurseId: string) => void;
  reassignNurse: (nurseId: string, assignedArea: ServiceType | 'Triage') => void;
  addAmbulance: (unitNumber: string, patientName: string, sex: string | undefined, chiefComplaint: string, priority: Priority, eta: number, notes?: string, lat?: number, lng?: number, age?: number) => void;
  updateAmbulanceLocation: (ambulanceId: string, lat: number, lng: number) => void;
  ambulanceArrived: (ambulanceId: string) => void;
  cancelAmbulance: (ambulanceId: string) => void;
  endOfDay: () => Promise<void>;
  getStats: () => QueueStats;
  getWaitingByService: (service: ServiceType) => Ticket[];
  updateTicketStatus: (ticketId: string, status: TicketStatus) => void;
  addHandoverNote: (area: HandoverNote['area'], author: string, content: string, shift: HandoverNote['shift']) => void;
  removeHandoverNote: (noteId: string) => void;
  toggleHandoverPin: (noteId: string) => void;
  addEscalation: (title: string, details: string, severity: EscalationSeverity, author: string, area: EscalationEntry['area']) => void;
  resolveEscalation: (entryId: string) => void;
  removeEscalation: (entryId: string) => void;
  addShift: (nurseId: string, nurseName: string, nurseRole: NurseRole, date: string, shift: ShiftType, area: ShiftEntry['area'], notes?: string) => void;
  removeShift: (shiftId: string) => void;
  admitToInpatient: (unitId: string, bedId: string, name: string, admittedFrom: 'ER' | 'Direct', age?: number, erTicketId?: string, diagnosis?: string, notes?: string) => void;
  dischargeInpatient: (unitId: string, bedId: string) => void;
  transferInpatientBed: (fromUnitId: string, fromBedId: string, toUnitId: string, toBedId: string) => void;
  updateInpatientBedStatus: (unitId: string, bedId: string, status: InpatientBedStatus) => void;
  addInpatientUnit: (name: string, abbreviation: string, color: string, bedCount: number) => void;
  editInpatientUnit: (unitId: string, name: string, abbreviation: string, color: string) => void;
  deleteInpatientUnit: (unitId: string) => void;
  addInpatientBeds: (unitId: string, count: number) => void;
}

const QueueContext = createContext<QueueContextType | null>(null);

/* ── localStorage helpers (kept as offline fallback) ── */
function saveStateLocal(state: QueueState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    localStorage.setItem(LS_VERSION_KEY, STATE_VERSION);
  } catch { /* quota exceeded – ignore */ }
}

function loadState(): QueueState {
  try {
    // Discard stale data when seed version changes
    if (localStorage.getItem(LS_VERSION_KEY) !== STATE_VERSION) {
      localStorage.removeItem(LS_KEY);
      localStorage.setItem(LS_VERSION_KEY, STATE_VERSION);
      return initialState;
    }
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueueState;
      // Rehydrate Date objects (JSON serialises them as strings)
      parsed.tickets = parsed.tickets.map(t => ({
        ...t,
        createdAt: new Date(t.createdAt),
        triagedAt: new Date(t.triagedAt),
        calledAt: t.calledAt ? new Date(t.calledAt) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      }));
      parsed.ambulances = parsed.ambulances.map(a => ({
        ...a,
        dispatchedAt: new Date(a.dispatchedAt),
        arrivedAt: a.arrivedAt ? new Date(a.arrivedAt) : undefined,
        lastLocationUpdate: a.lastLocationUpdate ? new Date(a.lastLocationUpdate) : undefined,
      }));
      if (parsed.handoverNotes) {
        parsed.handoverNotes = parsed.handoverNotes.map(n => ({ ...n, createdAt: new Date(n.createdAt) }));
      } else { parsed.handoverNotes = []; }
      if (parsed.escalationLog) {
        parsed.escalationLog = parsed.escalationLog.map(e => ({ ...e, createdAt: new Date(e.createdAt), resolvedAt: e.resolvedAt ? new Date(e.resolvedAt) : undefined }));
      } else { parsed.escalationLog = []; }
      if (!parsed.shifts) parsed.shifts = [];
      if (parsed.inpatientUnits) {
        parsed.inpatientUnits = parsed.inpatientUnits.map((u: InpatientUnit) => ({
          ...u,
          beds: u.beds.map((b: InpatientBed) =>
            b.patient
              ? { ...b, patient: { ...b.patient, admittedAt: new Date(b.patient.admittedAt) } }
              : b
          ),
        }));
      } else { parsed.inpatientUnits = initialInpatientUnits; }
      return parsed;
    }
  } catch { /* corrupt data – fall back */ }
  return initialState;
}

export function QueueProvider({ children, auditUser = null }: { children: ReactNode; auditUser?: AuditUser }) {
  const [state, dispatch] = useReducer(queueReducer, undefined, loadState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false);
  // Keep auditUser in a ref so callbacks don't re-create when user changes
  const auditUserRef = useRef<AuditUser>(auditUser);
  useEffect(() => { auditUserRef.current = auditUser; }, [auditUser]);

  // ── Persist: localStorage (offline fallback) + Firestore (cross-device) ──
  useEffect(() => {
    saveStateLocal(state);
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    // Debounce Firestore writes (300 ms) to avoid hammering on rapid actions
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setDoc(doc(db, FS_DOC), { state: JSON.stringify(state), version: STATE_VERSION })
        .catch(() => { /* offline — localStorage still has it */ });
    }, 300);
  }, [state]);

  // ── Real-time listener: sync state from Firestore to all open tabs/devices ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, FS_DOC), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data?.state || data.version !== STATE_VERSION) return;
      try {
        const parsed = JSON.parse(data.state) as QueueState;
        parsed.tickets = parsed.tickets.map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
          triagedAt: new Date(t.triagedAt),
          calledAt: t.calledAt ? new Date(t.calledAt) : undefined,
          completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        }));
        parsed.ambulances = parsed.ambulances.map(a => ({
          ...a,
          dispatchedAt: new Date(a.dispatchedAt),
          arrivedAt: a.arrivedAt ? new Date(a.arrivedAt) : undefined,
          lastLocationUpdate: a.lastLocationUpdate ? new Date(a.lastLocationUpdate) : undefined,
        }));
        if (parsed.handoverNotes) {
          parsed.handoverNotes = parsed.handoverNotes.map(n => ({ ...n, createdAt: new Date(n.createdAt) }));
        }
        if (parsed.escalationLog) {
          parsed.escalationLog = parsed.escalationLog.map(e => ({
            ...e, createdAt: new Date(e.createdAt),
            resolvedAt: e.resolvedAt ? new Date(e.resolvedAt) : undefined,
          }));
        }
        if (parsed.inpatientUnits) {
          parsed.inpatientUnits = parsed.inpatientUnits.map((u: InpatientUnit) => ({
            ...u,
            beds: u.beds.map((b: InpatientBed) =>
              b.patient ? { ...b, patient: { ...b.patient, admittedAt: new Date(b.patient.admittedAt) } } : b
            ),
          }));
        }
        isRemoteUpdate.current = true;
        dispatch({ type: 'SYNC_STATE', payload: parsed });
      } catch { /* corrupt remote data – ignore */ }
    }, () => { /* offline – stay on local state */ });
    return unsub;
  }, []);

  const addTicket = useCallback((patientName: string, service: ServiceType, priority: Priority, notes?: string, age?: number) => {
    dispatch({ type: 'ADD_TICKET', payload: { patientName, age, service, priority, notes } });
    logAudit(auditUserRef.current, 'Patient Triaged', `${patientName}${age ? `, ${age}y` : ''} | ${service} | ${priority}`);
  }, []);

  const admitToBay = useCallback((patientName: string, service: ServiceType, priority: Priority, counterId: number, notes?: string, age?: number, chiefComplaint?: string) => {
    dispatch({ type: 'ADMIT_TO_BAY', payload: { patientName, age, service, priority, notes, chiefComplaint, counterId } });
    logAudit(auditUserRef.current, 'Admitted to Bay', `${patientName}${age ? `, ${age}y` : ''} → Bay ${counterId} | ${service} | ${priority}`);
  }, []);

  const callNext = useCallback((counterId: number) => {
    dispatch({ type: 'CALL_NEXT', payload: { counterId } });
  }, []);

  const completeTicket = useCallback((ticketId: string) => {
    const t = state.tickets.find(x => x.id === ticketId);
    dispatch({ type: 'COMPLETE_TICKET', payload: { ticketId } });
    if (t) logAudit(auditUserRef.current, 'Ticket Completed', `${t.patientName} | ${t.service}`);
  }, [state.tickets]);

  const noShow = useCallback((ticketId: string) => {
    const t = state.tickets.find(x => x.id === ticketId);
    dispatch({ type: 'NO_SHOW', payload: { ticketId } });
    if (t) logAudit(auditUserRef.current, 'No-Show', `${t.patientName} | ${t.service}`);
  }, [state.tickets]);

  const markDeceased = useCallback((ticketId: string) => {
    const t = state.tickets.find(x => x.id === ticketId);
    dispatch({ type: 'MARK_DECEASED', payload: { ticketId } });
    if (t) logAudit(auditUserRef.current, 'Marked Deceased', `${t.patientName} | ${t.service}`);
  }, [state.tickets]);

  const recallTicket = useCallback((ticketId: string, counterId: number) => {
    dispatch({ type: 'RECALL_TICKET', payload: { ticketId, counterId } });
  }, []);

  const transferTicket = useCallback((ticketId: string, newService: ServiceType) => {
    dispatch({ type: 'TRANSFER_TICKET', payload: { ticketId, newService } });
  }, []);

  const addCounter = useCallback((name: string, service: ServiceType, beds: number) => {
    dispatch({ type: 'ADD_COUNTER', payload: { name, service, beds } });
  }, []);

  const toggleCounter = useCallback((counterId: number) => {
    dispatch({ type: 'TOGGLE_COUNTER', payload: { counterId } });
  }, []);

  const updateBeds = useCallback((counterId: number, bedsOccupied: number) => {
    dispatch({ type: 'UPDATE_BEDS', payload: { counterId, bedsOccupied } });
  }, []);

  const addNurse = useCallback((name: string, assignedArea: ServiceType | 'Triage', role: NurseRole) => {
    dispatch({ type: 'ADD_NURSE', payload: { name, assignedArea, role } });
  }, []);

  const removeNurse = useCallback((nurseId: string) => {
    dispatch({ type: 'REMOVE_NURSE', payload: { nurseId } });
  }, []);

  const toggleNurseDuty = useCallback((nurseId: string) => {
    dispatch({ type: 'TOGGLE_NURSE_DUTY', payload: { nurseId } });
  }, []);

  const reassignNurse = useCallback((nurseId: string, assignedArea: ServiceType | 'Triage') => {
    dispatch({ type: 'REASSIGN_NURSE', payload: { nurseId, assignedArea } });
  }, []);

  const addAmbulance = useCallback((unitNumber: string, patientName: string, sex: string | undefined, chiefComplaint: string, priority: Priority, eta: number, notes?: string, lat?: number, lng?: number, age?: number) => {
    dispatch({ type: 'ADD_AMBULANCE', payload: { unitNumber, patientName, sex, age, chiefComplaint, priority, eta, notes, lat, lng } });
    logAudit(auditUserRef.current, 'Ambulance Dispatched', `Unit ${unitNumber} | ${patientName}${age ? `, ${age}y` : ''} | ${chiefComplaint} | ETA ${eta} min`);
  }, []);

  const updateAmbulanceLocation = useCallback((ambulanceId: string, lat: number, lng: number) => {
    dispatch({ type: 'UPDATE_AMBULANCE_LOCATION', payload: { ambulanceId, lat, lng } });
  }, []);

  const ambulanceArrived = useCallback((ambulanceId: string) => {
    const a = state.ambulances.find(x => x.id === ambulanceId);
    dispatch({ type: 'AMBULANCE_ARRIVED', payload: { ambulanceId } });
    if (a) logAudit(auditUserRef.current, 'Ambulance Arrived', `Unit ${a.unitNumber} | ${a.patientName}`);
  }, [state.ambulances]);

  const cancelAmbulance = useCallback((ambulanceId: string) => {
    const a = state.ambulances.find(x => x.id === ambulanceId);
    dispatch({ type: 'CANCEL_AMBULANCE', payload: { ambulanceId } });
    if (a) logAudit(auditUserRef.current, 'Ambulance Cancelled', `Unit ${a.unitNumber} | ${a.patientName}`);
  }, [state.ambulances]);

  const endOfDay = useCallback(async () => {
    await saveDailyRecord(state.tickets);
    dispatch({ type: 'END_OF_DAY' });
    logAudit(auditUserRef.current, 'End of Day', `${state.tickets.filter(t => t.status === 'completed').length} completed, ${state.tickets.filter(t => t.status === 'waiting' || t.status === 'serving').length} cleared`);
  }, [state.tickets]);

  const getStats = useCallback((): QueueStats => {
    const waiting = state.tickets.filter(t => t.status === 'waiting');
    const serving = state.tickets.filter(t => t.status === 'serving');
    const completed = state.tickets.filter(t => t.status === 'completed');
    const noShowTickets = state.tickets.filter(t => t.status === 'no-show');

    const completedWithWait = [...completed, ...serving].filter(t => t.calledAt && t.createdAt);
    const avgWait = completedWithWait.length > 0
      ? completedWithWait.reduce((sum, t) => {
          const wait = (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000;
          return sum + wait;
        }, 0) / completedWithWait.length
      : 0;

    return {
      totalWaiting: waiting.length,
      totalServing: serving.length,
      totalCompleted: completed.length,
      totalNoShow: noShowTickets.length,
      avgWaitTime: Math.round(avgWait),
    };
  }, [state.tickets]);

  const getWaitingByService = useCallback((service: ServiceType): Ticket[] => {
    return state.tickets
      .filter(t => t.service === service && t.status === 'waiting')
      .sort((a, b) => {
        const priorityOrder: Record<Priority, number> = { critical: 0, emergent: 1, urgent: 2, 'non-urgent': 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [state.tickets]);

  const updateTicketStatus = useCallback((ticketId: string, status: TicketStatus) => {
    dispatch({ type: 'UPDATE_TICKET_STATUS_FULL', payload: { ticketId, status } });
  }, []);

  const addHandoverNote = useCallback((area: HandoverNote['area'], author: string, content: string, shift: HandoverNote['shift']) => {
    dispatch({ type: 'ADD_HANDOVER_NOTE', payload: { area, author, content, shift } });
  }, []);
  const removeHandoverNote = useCallback((noteId: string) => {
    dispatch({ type: 'REMOVE_HANDOVER_NOTE', payload: { noteId } });
  }, []);
  const toggleHandoverPin = useCallback((noteId: string) => {
    dispatch({ type: 'TOGGLE_HANDOVER_PIN', payload: { noteId } });
  }, []);

  const addEscalation = useCallback((title: string, details: string, severity: EscalationSeverity, author: string, area: EscalationEntry['area']) => {
    dispatch({ type: 'ADD_ESCALATION', payload: { title, details, severity, author, area } });
    logAudit(auditUserRef.current, 'Escalation Raised', `[${severity.toUpperCase()}] ${title} | ${area}`);
  }, []);
  const resolveEscalation = useCallback((entryId: string) => {
    const e = state.escalationLog.find(x => x.id === entryId);
    dispatch({ type: 'RESOLVE_ESCALATION', payload: { entryId } });
    if (e) logAudit(auditUserRef.current, 'Escalation Resolved', `${e.title} | ${e.area}`);
  }, [state.escalationLog]);
  const removeEscalation = useCallback((entryId: string) => {
    dispatch({ type: 'REMOVE_ESCALATION', payload: { entryId } });
  }, []);

  const addShift = useCallback((nurseId: string, nurseName: string, nurseRole: NurseRole, date: string, shift: ShiftType, area: ShiftEntry['area'], notes?: string) => {
    dispatch({ type: 'ADD_SHIFT', payload: { nurseId, nurseName, nurseRole, date, shift, area, notes } });
  }, []);
  const removeShift = useCallback((shiftId: string) => {
    dispatch({ type: 'REMOVE_SHIFT', payload: { shiftId } });
  }, []);

  const admitToInpatient = useCallback((unitId: string, bedId: string, name: string, admittedFrom: 'ER' | 'Direct', age?: number, erTicketId?: string, diagnosis?: string, notes?: string) => {
    const unitName = state.inpatientUnits.find(u => u.id === unitId)?.name ?? unitId;
    const bedNum = state.inpatientUnits.find(u => u.id === unitId)?.beds.find(b => b.id === bedId)?.bedNumber ?? bedId;
    dispatch({ type: 'ADMIT_TO_INPATIENT', payload: { unitId, bedId, name, age, admittedFrom, erTicketId, diagnosis, notes } });
    logAudit(auditUserRef.current, 'Inpatient Admitted', `${name}${age ? `, ${age}y` : ''} → ${unitName} ${bedNum} | ${admittedFrom}${diagnosis ? ` | ${diagnosis}` : ''}`);
  }, [state.inpatientUnits]);

  const dischargeInpatient = useCallback((unitId: string, bedId: string) => {
    const unit = state.inpatientUnits.find(u => u.id === unitId);
    const bed = unit?.beds.find(b => b.id === bedId);
    dispatch({ type: 'DISCHARGE_INPATIENT', payload: { unitId, bedId } });
    if (bed?.patient) logAudit(auditUserRef.current, 'Inpatient Discharged', `${bed.patient.name} from ${unit?.name ?? unitId} ${bed.bedNumber}`);
  }, [state.inpatientUnits]);
  const transferInpatientBed = useCallback((fromUnitId: string, fromBedId: string, toUnitId: string, toBedId: string) => {
    const fromUnit = state.inpatientUnits.find(u => u.id === fromUnitId);
    const fromBed = fromUnit?.beds.find(b => b.id === fromBedId);
    const toUnit = state.inpatientUnits.find(u => u.id === toUnitId);
    const toBed = toUnit?.beds.find(b => b.id === toBedId);
    dispatch({ type: 'TRANSFER_INPATIENT_BED', payload: { fromUnitId, fromBedId, toUnitId, toBedId } });
    if (fromBed?.patient) logAudit(auditUserRef.current, 'Inpatient Transferred', `${fromBed.patient.name}: ${fromUnit?.abbreviation ?? fromUnitId} ${fromBed.bedNumber} → ${toUnit?.abbreviation ?? toUnitId} ${toBed?.bedNumber ?? toBedId}`);
  }, [state.inpatientUnits]);

  const updateInpatientBedStatus = useCallback((unitId: string, bedId: string, status: InpatientBedStatus) => {
    const unit = state.inpatientUnits.find(u => u.id === unitId);
    const bed = unit?.beds.find(b => b.id === bedId);
    dispatch({ type: 'UPDATE_INPATIENT_BED_STATUS', payload: { unitId, bedId, status } });
    if (bed?.patient && (status === 'available' || status === 'cleaning')) {
      logAudit(auditUserRef.current, 'Census Override', `${bed.patient.name} cleared from ${unit?.abbreviation ?? unitId} ${bed.bedNumber} → ${status}`);
    }
  }, [state.inpatientUnits]);
  const addInpatientUnit = useCallback((name: string, abbreviation: string, color: string, bedCount: number) => {
    dispatch({ type: 'ADD_INPATIENT_UNIT', payload: { id: `unit-${Date.now()}`, name, abbreviation, color, bedCount } });
    logAudit(auditUserRef.current, 'Ward Added', `${name} (${abbreviation}) — ${bedCount} beds`);
  }, []);
  const editInpatientUnit = useCallback((unitId: string, name: string, abbreviation: string, color: string) => {
    dispatch({ type: 'EDIT_INPATIENT_UNIT', payload: { unitId, name, abbreviation, color } });
    logAudit(auditUserRef.current, 'Ward Edited', `${name} (${abbreviation})`);
  }, []);
  const deleteInpatientUnit = useCallback((unitId: string) => {
    const unitName = state.inpatientUnits.find(u => u.id === unitId)?.name ?? unitId;
    dispatch({ type: 'DELETE_INPATIENT_UNIT', payload: { unitId } });
    logAudit(auditUserRef.current, 'Ward Deleted', unitName);
  }, [state.inpatientUnits]);
  const addInpatientBeds = useCallback((unitId: string, count: number) => {
    dispatch({ type: 'ADD_INPATIENT_BEDS', payload: { unitId, count } });
  }, []);

  // Derive bedsOccupied from actual serving ticket counts so it always reflects real patient numbers
  const derivedState = useMemo(() => ({
    ...state,
    counters: state.counters.map(c => ({
      ...c,
      bedsOccupied: state.tickets.filter(t => t.status === 'serving' && t.counterNumber === c.id).length,
    })),
  }), [state]);

  return (
    <QueueContext.Provider value={{
      state: derivedState,
      addTicket,
      admitToBay,
      callNext,
      completeTicket,
      noShow,
      markDeceased,
      recallTicket,
      transferTicket,
      addCounter,
      toggleCounter,
      updateBeds,
      addNurse,
      removeNurse,
      toggleNurseDuty,
      reassignNurse,
      addAmbulance,
      updateAmbulanceLocation,
      ambulanceArrived,
      cancelAmbulance,
      endOfDay,
      getStats,
      getWaitingByService,
      updateTicketStatus,
      addHandoverNote,
      removeHandoverNote,
      toggleHandoverPin,
      addEscalation,
      resolveEscalation,
      removeEscalation,
      addShift,
      removeShift,
      admitToInpatient,
      dischargeInpatient,
      transferInpatientBed,
      updateInpatientBedStatus,
      addInpatientUnit,
      editInpatientUnit,
      deleteInpatientUnit,
      addInpatientBeds,
    }}>
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueProvider');
  return ctx;
}
