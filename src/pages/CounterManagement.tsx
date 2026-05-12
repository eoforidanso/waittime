import { useState } from 'react';
import { useQueue } from '../context/QueueContext';
import type { ServiceType, NurseRole } from '../types';
import { SERVICE_TYPES, SERVICE_COLORS } from '../types';
import { Settings, Plus, ToggleLeft, ToggleRight, Bed, Stethoscope, UserMinus, X, Printer, Syringe, UserPlus, ChevronDown, MonitorPlay } from 'lucide-react';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { useConfirm } from '../components/ConfirmDialog';

type StaffCategory = 'nurse' | 'physician';

const PHYSICIAN_POOL: string[] = [
  'Dr. Akosua Amponsah', 'Dr. Kwame Baffoe', 'Dr. Efua Asante', 'Dr. Nana Boateng',
  'Dr. Kofi Mensah', 'Dr. Abena Quaye', 'Dr. Samuel Owusu', 'Dr. Adwoa Agyemang',
  'Dr. Kwesi Tetteh', 'Dr. Yaa Frimpong', 'Dr. Fiifi Osei', 'Dr. Maame Darko',
  'Dr. Paa Kweku Adjei', 'Dr. Esi Amoah', 'Dr. Nii Ankrah',
];

const PA_POOL: string[] = [
  'Abena Asiedu', 'Kwame Bonsu', 'Akua Ofori', 'Kofi Ennin', 'Yaw Quartey',
  'Adwoa Siaw', 'Ama Inkoom', 'Nana Asamoah', 'Kwesi Gyasi', 'Efua Antwi',
  'Fiifi Kyei', 'Maame Appiah', 'Paa Kweku Baidoo',
];

function getRoleTag(role: NurseRole): { cls: string; label: string } {
  switch (role) {
    case 'Charge Nurse': return { cls: 'charge', label: 'CN' };
    case 'Staff Nurse': return { cls: 'staff', label: 'SN' };
    case 'Attending Physician': return { cls: 'physician', label: 'DR' };
    case 'Physician Assistant': return { cls: 'pa', label: 'PA' };
  }
}

export default function CounterManagement() {
  const { state, addCounter, toggleCounter, addNurse, removeNurse, toggleNurseDuty, reassignNurse } = useQueue();
  const { flags, toggleFlag } = useFeatureFlags();
  const { confirm, Dialog: ConfirmEl } = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newService, setNewService] = useState<ServiceType>('Acute Care');
  const [newBeds, setNewBeds] = useState(4);

  // Staff form state
  const [showAddNurse, setShowAddNurse] = useState(false);
  const [staffCategory, setStaffCategory] = useState<StaffCategory>('nurse');
  const [nurseName, setNurseName] = useState('');
  const [nurseArea, setNurseArea] = useState<ServiceType | 'Triage'>('Triage');
  const [nurseRole, setNurseRole] = useState<NurseRole>('Staff Nurse');
  const nurseAreas: (ServiceType | 'Triage')[] = ['Triage', ...SERVICE_TYPES];
  // Physicians & PAs consult in ER service areas only — no Triage, no Resuscitation
  const physicianAreas: ServiceType[] = SERVICE_TYPES.filter(
    s => s !== 'Resuscitation'
  );

  // Bay nurse assignment state
  const [assignNurseBayId, setAssignNurseBayId] = useState<number | null>(null);

  const handlePrintToPDF = () => {
    const printDate = new Date().toLocaleString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const baysHtml = state.counters.map(c => {
      const staff = state.nurses.filter(n => n.onDuty && n.assignedArea === c.service);
      const available = c.beds - c.bedsOccupied;
      const occupancyPct = Math.round((c.bedsOccupied / c.beds) * 100);
      const staffHtml = staff.length > 0
        ? staff.map(n => {
            const tag = getRoleTag(n.role);
            const isProvider = n.role === 'Attending Physician' || n.role === 'Physician Assistant';
            return `<span class="chip chip-${tag.cls}">${tag.label}</span>${n.name}${isProvider ? ' <span class="badge-consulting">Consulting</span>' : ''}`;
          }).join(' &nbsp;&middot;&nbsp; ')
        : '<em style="color:#888">No staff assigned</em>';
      return `
        <div class="bay-card${c.isActive ? '' : ' inactive'}">
          <div class="bay-header">
            <span class="bay-name">${c.name}</span>
            <span class="bay-status ${c.isActive ? 'active' : 'off'}">${c.isActive ? 'ACTIVE' : 'OFFLINE'}</span>
          </div>
          <span class="bay-service" style="background:${SERVICE_COLORS[c.service]}">${c.service}</span>
          <div class="bay-beds">
            <strong>${c.bedsOccupied}/${c.beds}</strong> beds occupied &nbsp;&middot;&nbsp;
            <strong>${available}</strong> available &nbsp;&middot;&nbsp; ${occupancyPct}% occupancy
            ${available <= 1 ? '<span class="badge-alert">LOW BEDS</span>' : ''}
          </div>
          ${c.currentTicket ? `<div class="bay-serving">Serving: <strong>${c.currentTicket.ticketNumber}</strong></div>` : ''}
          <div class="bay-staff"><strong>Staff:</strong> ${staffHtml}</div>
        </div>`;
    }).join('');

    const allPhysicians = [...onDutyPhysicians, ...offDutyPhysicians];
    const physHtml = allPhysicians.map(n => {
      const tag = getRoleTag(n.role);
      return `<tr>
        <td>${n.name}</td>
        <td><span class="chip chip-${tag.cls}">${tag.label}&nbsp;${n.role}</span></td>
        <td><span class="badge-consulting">Consulting</span></td>
        <td>${n.assignedArea}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="color:#888">No physicians on roster</td></tr>';

    const nurseRowHtml = (nurses: typeof onDutyNurses, onDuty: boolean) =>
      nurses.map(n => {
        const tag = getRoleTag(n.role);
        return `<tr>
          <td>${n.name}</td>
          <td><span class="chip chip-${tag.cls}">${tag.label}&nbsp;${n.role}</span></td>
          <td class="${onDuty ? 'dot-on' : 'dot-off'}">${onDuty ? '● On Duty' : '● Off Duty'}</td>
          <td>${n.assignedArea}</td>
        </tr>`;
      }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bay &amp; ER Area Report</title>
  <style>
    @page { size: A4 portrait; margin: 1.5cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; background: #fff; }
    h1 { font-size: 15pt; font-weight: 700; }
    h2 { font-size: 11.5pt; font-weight: 700; margin: 1.1em 0 0.45em; border-bottom: 1.5px solid #1a1a2e; padding-bottom: 0.2em; }
    .report-header { border-bottom: 2px solid #1a1a2e; padding-bottom: 0.45cm; margin-bottom: 0.6cm; }
    .report-date { font-size: 9pt; color: #555; margin-top: 0.2cm; }
    .summary-row { display: flex; flex-wrap: wrap; gap: 1.2cm; margin-bottom: 0.5cm; font-size: 9.5pt; color: #444; }
    .bays-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4cm; margin-bottom: 0.6cm; }
    .bay-card { border: 1px solid #ccc; border-radius: 5px; padding: 0.4cm; break-inside: avoid; page-break-inside: avoid; }
    .bay-card.inactive { opacity: 0.55; }
    .bay-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2cm; }
    .bay-name { font-weight: 700; font-size: 10.5pt; }
    .bay-status { font-size: 7.5pt; font-weight: 700; padding: 1px 7px; border-radius: 10px; }
    .bay-status.active { background: #dcfce7; color: #15803d; }
    .bay-status.off { background: #f1f5f9; color: #64748b; }
    .bay-service { display: inline-block; padding: 1px 9px; border-radius: 9px; font-size: 8pt; font-weight: 600; color: #fff; margin-bottom: 0.22cm; }
    .bay-beds { font-size: 9pt; color: #333; margin-bottom: 0.12cm; }
    .bay-serving { font-size: 9pt; color: #b45309; margin-bottom: 0.12cm; }
    .bay-staff { font-size: 8.5pt; color: #333; margin-top: 0.1cm; line-height: 1.7; }
    .badge-alert { background: #fecaca; color: #b91c1c; font-size: 7pt; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 4px; }
    .badge-consulting { background: #cffafe; color: #0e7490; font-size: 7.5pt; font-weight: 600; padding: 1px 6px; border-radius: 9px; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 0.4cm; }
    th { background: #f1f5f9; text-align: left; padding: 4px 8px; font-size: 9pt; font-weight: 700; border: 1px solid #e2e8f0; }
    td { padding: 3px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .chip { display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 8pt; font-weight: 700; }
    .chip-physician { background: #e0e7ff; color: #3730a3; }
    .chip-pa { background: #d1fae5; color: #065f46; }
    .chip-charge { background: #f3e8ff; color: #7e22ce; }
    .chip-staff { background: #e0f2fe; color: #0369a1; }
    .dot-on { color: #15803d; font-weight: 600; }
    .dot-off { color: #94a3b8; }
    .footer { margin-top: 0.8cm; padding-top: 0.3cm; border-top: 1px solid #ccc; font-size: 8pt; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Bay &amp; ER Area Management Report</h1>
    <div class="report-date">Generated: ${printDate}</div>
  </div>
  <div class="summary-row">
    <span>Total Bays: <strong>${state.counters.length}</strong></span>
    <span>Active: <strong>${state.counters.filter(c => c.isActive).length}</strong></span>
    <span>Physicians / PAs: <strong>${allPhysicians.length}</strong></span>
    <span>Nurses On Duty: <strong>${onDutyNurses.length}</strong></span>
    <span>Nurses Off Duty: <strong>${offDutyNurses.length}</strong></span>
  </div>
  <h2>Bay Cards</h2>
  <div class="bays-grid">${baysHtml}</div>
  <h2>Physicians &amp; Physician Assistants</h2>
  <table>
    <thead><tr><th>Name</th><th>Role</th><th>Activity</th><th>Area</th></tr></thead>
    <tbody>${physHtml}</tbody>
  </table>
  <h2>Nurse Staffing</h2>
  <table>
    <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Area</th></tr></thead>
    <tbody>${nurseRowHtml(onDutyNurses, true)}${nurseRowHtml(offDutyNurses, false)}</tbody>
  </table>
  <div class="footer">MediQ ER Management System &mdash; Confidential &mdash; ${printDate}</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups for this page and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addCounter(newName.trim(), newService, newBeds);
    setNewName('');
    setNewBeds(4);
    setShowAdd(false);
  };

  const handleAddNurse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nurseName.trim()) return;
    addNurse(nurseName.trim(), nurseArea, nurseRole);
    setNurseName('');
    setNurseRole(staffCategory === 'physician' ? 'Attending Physician' : 'Staff Nurse');
    setShowAddNurse(false);
  };

  const handleRemoveNurse = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Remove Staff Member',
      message: `Remove ${name} from the roster? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (ok) removeNurse(id);
  };

  const PHYSICIAN_ROLES: NurseRole[] = ['Attending Physician', 'Physician Assistant'];
  const NURSE_ROLES: NurseRole[] = ['Staff Nurse', 'Charge Nurse'];

  const onDutyNurses = state.nurses.filter(n => n.onDuty && NURSE_ROLES.includes(n.role));
  const offDutyNurses = state.nurses.filter(n => !n.onDuty && NURSE_ROLES.includes(n.role));
  const onDutyPhysicians = state.nurses.filter(n => n.onDuty && PHYSICIAN_ROLES.includes(n.role));
  const offDutyPhysicians = state.nurses.filter(n => !n.onDuty && PHYSICIAN_ROLES.includes(n.role));

  // Pool of names not yet on the roster, filtered by selected role
  const existingNames = new Set(state.nurses.map(n => n.name));
  const availablePhysicianNames = PHYSICIAN_POOL.filter(n => !existingNames.has(n));
  const availablePANames = PA_POOL.filter(n => !existingNames.has(n));
  const namePool = nurseRole === 'Attending Physician' ? availablePhysicianNames : availablePANames;

  return (
    <div className="counter-mgmt-page printable-section">
      <div className="page-header" data-print-date={new Date().toLocaleString()}>
        <h1><Settings size={28} /> Bay & ER Area Management</h1>
        <p>Configure treatment bays and their assigned ER areas</p>
      </div>

      {/* ── Module Settings ── */}
      <div className="module-settings-card">
        <h3 className="module-settings-title">
          <Settings size={18} /> Module Settings
        </h3>
        <p className="module-settings-desc">Enable or disable optional workflow modules for this hospital.</p>
        <div className="module-toggle-row">
          <div className="module-toggle-info">
            <span className="module-toggle-name"><MonitorPlay size={15} /> ER Queue Management</span>
            <span className="module-toggle-desc">Real-time patient queue, ticket workflow and counter operations</span>
          </div>
          <button
            className={`module-toggle-btn${flags.erQueue ? ' on' : ' off'}`}
            onClick={() => toggleFlag('erQueue')}
            aria-pressed={flags.erQueue}
            title={flags.erQueue ? 'Click to disable ER Queue' : 'Click to enable ER Queue'}
          >
            {flags.erQueue ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            {flags.erQueue ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="counter-actions">
        <button className="btn-add" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={16} /> Add Bay
        </button>
        <button className="btn-print" onClick={handlePrintToPDF} title="Export bay & staffing report as PDF">
          <Printer size={16} /> Export PDF
        </button>
      </div>

      {showAdd && (
        <form className="add-counter-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Bay name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
            autoComplete="off"
          />
          <select value={newService} onChange={e => setNewService(e.target.value as ServiceType)}>
            {SERVICE_TYPES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Beds"
            value={newBeds}
            min={1}
            max={50}
            onChange={e => setNewBeds(Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <button type="submit" className="btn-submit-sm">Create</button>
        </form>
      )}

      {/* Physician & PA Panel */}
      <div className="nurse-panel">
        <div className="nurse-panel-header">
          <h3><Syringe size={20} /> Physicians & PAs</h3>
          <div className="nurse-panel-summary">
            <span className="nurse-count-badge total">{onDutyPhysicians.length + offDutyPhysicians.length} Providers</span>
          </div>
          <button className="btn-add btn-add-sm" onClick={() => { setStaffCategory('physician'); setNurseRole('Attending Physician'); setNurseArea('Acute Care'); setShowAddNurse(s => staffCategory === 'physician' ? !s : true); }}>
            <Plus size={14} /> Add Physician
          </button>
        </div>

        {showAddNurse && staffCategory === 'physician' && (
          <form className="add-nurse-form" onSubmit={handleAddNurse}>
            <select
              value={nurseRole}
              onChange={e => { setNurseRole(e.target.value as NurseRole); setNurseName(''); }}
            >
              <option value="Attending Physician">Attending Physician</option>
              <option value="Physician Assistant">Physician Assistant</option>
            </select>
            <select
              value={nurseName}
              onChange={e => setNurseName(e.target.value)}
              required
            >
              <option value="">— Select name —</option>
              {namePool.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button type="submit" className="btn-submit-sm" disabled={!nurseName}>Add</button>
          </form>
        )}

        <div className="nurse-list-section">
          <div className="nurse-list">
            {[...onDutyPhysicians, ...offDutyPhysicians].map(n => {
              const tag = getRoleTag(n.role);
              return (
                <div key={n.id} className="nurse-list-item">
                  <span className="nurse-dot on" />
                  <span className="nurse-item-name">{n.name}</span>
                  <span className={`nurse-role-tag ${tag.cls}`}>{tag.label}</span>
                  <span className="nurse-activity-tag consulting">Consulting</span>
                  <span className="nurse-area-tag" style={{ background: SERVICE_COLORS[n.assignedArea as ServiceType] }}>
                    {n.assignedArea}
                  </span>
                  <span
                    className="nurse-area-print"
                    style={{ background: SERVICE_COLORS[n.assignedArea as ServiceType] }}
                  >
                    {n.assignedArea}
                  </span>
                  <button className="nurse-action-btn danger" onClick={() => handleRemoveNurse(n.id, n.name)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Nurse Staffing Panel */}
      <div className="nurse-panel">
        <div className="nurse-panel-header">
          <h3><Stethoscope size={20} /> Nurse Staffing</h3>
          <div className="nurse-panel-summary">
            <span className="nurse-count-badge on">{onDutyNurses.length} On Duty</span>
            <span className="nurse-count-badge off">{offDutyNurses.length} Off Duty</span>
            <span className="nurse-count-badge total">{onDutyNurses.length + offDutyNurses.length} Total</span>
          </div>
          <button className="btn-add btn-add-sm" onClick={() => { setStaffCategory('nurse'); setNurseRole('Staff Nurse'); setShowAddNurse(s => staffCategory === 'nurse' ? !s : true); }}>
            <Plus size={14} /> Add Nurse
          </button>
        </div>

        {showAddNurse && staffCategory === 'nurse' && (
          <form className="add-nurse-form" onSubmit={handleAddNurse}>
            <input
              type="text"
              placeholder="Nurse name"
              value={nurseName}
              onChange={e => setNurseName(e.target.value)}
              required
              autoComplete="off"
            />
            <select value={nurseArea} onChange={e => setNurseArea(e.target.value as ServiceType | 'Triage')}>
              {nurseAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select value={nurseRole} onChange={e => setNurseRole(e.target.value as NurseRole)}>
              <option value="Staff Nurse">Staff Nurse</option>
              <option value="Charge Nurse">Charge Nurse</option>
            </select>
            <button type="submit" className="btn-submit-sm">Add</button>
          </form>
        )}

        <div className="nurse-list-section">
          <h4 className="nurse-list-heading on">On Duty ({onDutyNurses.length})</h4>
          <div className="nurse-list">
            {onDutyNurses.map(n => {
              const tag = getRoleTag(n.role);
              return (
                <div key={n.id} className="nurse-list-item on">
                  <span className="nurse-dot on" />
                  <span className="nurse-item-name">{n.name}</span>
                  <span className={`nurse-role-tag ${tag.cls}`}>{tag.label}</span>
                  <select
                    className="nurse-area-select"
                    value={n.assignedArea}
                    onChange={e => reassignNurse(n.id, e.target.value as ServiceType | 'Triage')}
                  >
                    {nurseAreas.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <span
                    className="nurse-area-print"
                    style={{ background: n.assignedArea === 'Triage' ? '#6366f1' : SERVICE_COLORS[n.assignedArea as ServiceType] }}
                  >
                    {n.assignedArea}
                  </span>
                  <button className="nurse-action-btn" onClick={() => toggleNurseDuty(n.id)} title="Set off duty">
                    <UserMinus size={14} />
                  </button>
                  <button className="nurse-action-btn danger" onClick={() => handleRemoveNurse(n.id, n.name)} title="Remove nurse">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <h4 className="nurse-list-heading off">Off Duty ({offDutyNurses.length})</h4>
          <div className="nurse-list">
            {offDutyNurses.map(n => {
              const tag = getRoleTag(n.role);
              return (
                <div key={n.id} className="nurse-list-item off">
                  <span className="nurse-dot off" />
                  <span className="nurse-item-name">{n.name}</span>
                  <span className={`nurse-role-tag ${tag.cls}`}>{tag.label}</span>
                  <span className="nurse-area-tag" style={{ background: n.assignedArea === 'Triage' ? '#6366f1' : SERVICE_COLORS[n.assignedArea as ServiceType] }}>
                    {n.assignedArea}
                  </span>
                  <button className="nurse-action-btn success" onClick={() => toggleNurseDuty(n.id)} title="Set on duty">
                    <Plus size={14} />
                  </button>
                  <button className="nurse-action-btn danger" onClick={() => handleRemoveNurse(n.id, n.name)} title="Remove nurse">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="counters-grid">
        {state.counters.map(c => {
          const bayStaff = state.nurses.filter(
            n => n.onDuty && n.assignedArea === c.service
          );
          // On-duty nurses NOT already assigned to this bay's service (excludes physicians/PAs)
          const assignableNurses = state.nurses.filter(
            n => n.onDuty &&
            (n.role === 'Staff Nurse' || n.role === 'Charge Nurse') &&
            n.assignedArea !== c.service
          );
          const isAssignOpen = assignNurseBayId === c.id;
          return (
          <div key={c.id} className={`counter-card ${c.isActive ? 'active' : 'inactive'}`}>
            <div className="counter-card-header">
              <h3>{c.name}</h3>
              <button className="toggle-btn" onClick={() => toggleCounter(c.id)}>
                {c.isActive ? <ToggleRight size={24} color="#10b981" /> : <ToggleLeft size={24} color="#94a3b8" />}
              </button>
            </div>
            <span className="counter-service" style={{ background: SERVICE_COLORS[c.service] }}>
              {c.service}
            </span>
            <div className="counter-beds">
              <Bed size={16} />
              <span className={`bed-label ${c.beds - c.bedsOccupied <= 1 ? 'beds-low' : ''}`}>
                {c.bedsOccupied} / {c.beds} beds occupied
              </span>
            </div>
            <div className="counter-status">
              {c.currentTicket ? (
                <span className="busy">Serving: {c.currentTicket.ticketNumber}</span>
              ) : (
                <span className="free">{c.isActive ? 'Available' : 'Offline'}</span>
              )}
            </div>
            {bayStaff.length > 0 && (
              <div className="bay-staff-list">
                {bayStaff.map(n => {
                  const tag = getRoleTag(n.role);
                  const isNurse = n.role === 'Staff Nurse' || n.role === 'Charge Nurse';
                  return (
                    <span key={n.id} className="bay-staff-chip">
                      <span className={`bay-staff-role ${tag.cls}`}>{tag.label}</span>
                      {n.name}
                      {(n.role === 'Attending Physician' || n.role === 'Physician Assistant') && (
                        <span className="bay-staff-activity">Consulting</span>
                      )}
                      {isNurse && (
                        <button
                          className="bay-staff-unassign"
                          title="Unassign from bay"
                          onClick={() => reassignNurse(n.id, 'Triage')}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {c.isActive && (
              <div className="bay-assign-wrap">
                <button
                  className={`bay-assign-btn${isAssignOpen ? ' open' : ''}`}
                  onClick={() => setAssignNurseBayId(isAssignOpen ? null : c.id)}
                  disabled={assignableNurses.length === 0}
                  title={assignableNurses.length === 0 ? 'No available nurses to assign' : 'Assign a nurse to this bay'}
                >
                  <UserPlus size={13} /> Assign Nurse <ChevronDown size={11} />
                </button>
                {isAssignOpen && (
                  <div className="bay-assign-picker">
                    {assignableNurses.map(n => {
                      const tag = getRoleTag(n.role);
                      return (
                        <button
                          key={n.id}
                          className="bay-assign-option"
                          onClick={() => { reassignNurse(n.id, c.service); setAssignNurseBayId(null); }}
                        >
                          <span className={`bay-staff-role ${tag.cls}`}>{tag.label}</span>
                          <span className="bay-assign-name">{n.name}</span>
                          <span className="bay-assign-from">{n.assignedArea}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
      {ConfirmEl}
    </div>
  );
}
