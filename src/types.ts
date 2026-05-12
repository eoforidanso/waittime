export type ServiceType =
  | 'Trauma'
  | 'Acute Care'
  | 'Fast Track'
  | 'Pediatric ER'
  | 'Observation'
  | 'Resuscitation';

export type TicketStatus =
  | 'waiting'
  | 'serving'
  | 'results-pending'
  | 'awaiting-bed'
  | 'referred'
  | 'discharged'
  | 'admitted'
  | 'completed'
  | 'no-show'
  | 'deceased';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  'waiting': 'Waiting',
  'serving': 'In Bay',
  'results-pending': 'Results Pending',
  'awaiting-bed': 'Awaiting Bed',
  'referred': 'Referred',
  'discharged': 'Discharged',
  'admitted': 'Admitted',
  'completed': 'Completed',
  'no-show': 'No Show',
  'deceased': 'Deceased',
};

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  'waiting':          '#f59e0b',
  'serving':          '#10b981',
  'results-pending':  '#3b82f6',
  'awaiting-bed':     '#8b5cf6',
  'referred':         '#06b6d4',
  'discharged':       '#6b7280',
  'admitted':         '#ec4899',
  'completed':        '#4b5563',
  'no-show':          '#ef4444',
  'deceased':         '#1f2937',
};

export type Priority = 'non-urgent' | 'urgent' | 'emergent' | 'critical';

export interface Ticket {
  id: string;
  ticketNumber: string;
  patientName: string;
  age?: number;
  service: ServiceType;
  priority: Priority;
  status: TicketStatus;
  createdAt: Date;
  triagedAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  estimatedWait: number; // minutes
  counterNumber?: number;
  notes?: string;
  chiefComplaint?: string;
}

export interface Counter {
  id: number;
  name: string;
  service: ServiceType;
  isActive: boolean;
  currentTicket?: Ticket;
  beds: number;
  bedsOccupied: number;
  reservedBeds?: number;
}

export interface QueueStats {
  totalWaiting: number;
  totalServing: number;
  totalCompleted: number;
  totalNoShow: number;
  avgWaitTime: number;
}

export type NurseRole = 'Staff Nurse' | 'Charge Nurse' | 'Attending Physician' | 'Physician Assistant';

export interface Nurse {
  id: string;
  name: string;
  role: NurseRole;
  onDuty: boolean;
  assignedArea: ServiceType | 'Triage';
}

export const SERVICE_TYPES: ServiceType[] = [
  'Resuscitation',
  'Trauma',
  'Acute Care',
  'Fast Track',
  'Pediatric ER',
  'Observation',
];

export const SERVICE_PREFIXES: Record<ServiceType, string> = {
  'Resuscitation': 'RS',
  'Trauma': 'TR',
  'Acute Care': 'AC',
  'Fast Track': 'FT',
  'Pediatric ER': 'PD',
  'Observation': 'OB',
};

export const SERVICE_COLORS: Record<ServiceType, string> = {
  'Resuscitation': '#dc2626',
  'Trauma': '#ef4444',
  'Acute Care': '#f59e0b',
  'Fast Track': '#10b981',
  'Pediatric ER': '#3b82f6',
  'Observation': '#8b5cf6',
};

export const TRIAGE_COLORS: Record<Priority, string> = {
  'critical': '#dc2626',
  'emergent': '#ef4444',
  'urgent': '#f59e0b',
  'non-urgent': '#10b981',
};

export type AmbulanceStatus = 'en-route' | 'arrived' | 'cancelled';

export interface Ambulance {
  id: string;
  unitNumber: string;
  patientName: string;
  sex?: string;
  age?: number;
  chiefComplaint: string;
  priority: Priority;
  eta: number; // minutes
  status: AmbulanceStatus;
  dispatchedAt: Date;
  arrivedAt?: Date;
  lat?: number;
  lng?: number;
  lastLocationUpdate?: Date;
  notes?: string;
  bedHoldCounterId?: number;
  gateAlertFired?: boolean;
}

// ── NHS target times (minutes from triage) ──────────────────────────────────
export const BREACH_TARGETS: Record<Priority, number> = {
  critical:    0,   // immediate
  emergent:   15,
  urgent:     60,
  'non-urgent': 120,
};

// ── Handover notes ─────────────────────────────────────────────────────────
export interface HandoverNote {
  id: string;
  area: ServiceType | 'Triage' | 'General';
  author: string;
  content: string;
  createdAt: Date;
  shift: 'Day' | 'Evening' | 'Night';
  pinned: boolean;
}

// ── Escalation log ─────────────────────────────────────────────────────────
export type EscalationSeverity = 'info' | 'warning' | 'critical';

export interface EscalationEntry {
  id: string;
  title: string;
  details: string;
  severity: EscalationSeverity;
  author: string;
  area: ServiceType | 'Triage' | 'All Areas';
  createdAt: Date;
  resolvedAt?: Date;
  resolved: boolean;
}

// ── Shift scheduling ───────────────────────────────────────────────────────
export type ShiftType = 'Day' | 'Evening' | 'Night';

export interface ShiftEntry {
  id: string;
  nurseId: string;
  nurseName: string;
  nurseRole: NurseRole;
  date: string;        // ISO date string YYYY-MM-DD
  shift: ShiftType;
  area: ServiceType | 'Triage';
  notes?: string;
}

export const SHIFT_HOURS: Record<ShiftType, string> = {
  Day:     '07:00 – 15:00',
  Evening: '15:00 – 23:00',
  Night:   '23:00 – 07:00',
};

// ── Inpatient (ward) management ────────────────────────────────────────────
export type InpatientBedStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance';

export const INPATIENT_BED_STATUS_COLORS: Record<InpatientBedStatus, string> = {
  available:   '#10b981',
  occupied:    '#ef4444',
  cleaning:    '#f59e0b',
  maintenance: '#6b7280',
};

export const INPATIENT_BED_STATUS_LABELS: Record<InpatientBedStatus, string> = {
  available:   'Available',
  occupied:    'Occupied',
  cleaning:    'Cleaning',
  maintenance: 'Maintenance',
};

export interface InpatientPatient {
  id: string;
  name: string;
  age?: number;
  admittedAt: Date;
  admittedFrom: 'ER' | 'Direct';
  erTicketId?: string;
  diagnosis?: string;
  notes?: string;
}

export interface InpatientBed {
  id: string;
  bedNumber: string;
  status: InpatientBedStatus;
  patient?: InpatientPatient;
}

export interface InpatientUnit {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  beds: InpatientBed[];
}

