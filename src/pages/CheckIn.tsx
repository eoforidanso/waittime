import { useState, useEffect, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import type { ServiceType, Priority } from '../types';
import { SERVICE_TYPES, SERVICE_COLORS, TRIAGE_COLORS, SERVICE_PREFIXES } from '../types';
import { UserPlus, CheckCircle, ClipboardPlus, BedDouble, ListOrdered, Printer, X, AlertTriangle } from 'lucide-react';

const IMMEDIATE_SERVICES: ServiceType[] = ['Resuscitation', 'Trauma'];
const IMMEDIATE_PRIORITIES: Priority[] = ['critical', 'emergent'];

export default function CheckIn() {
  const { addTicket, admitToBay, state } = useQueue();
  const toast = useToast();
  const [lastName, setLastName] = useState('');
  const [firstInitial, setFirstInitial] = useState('');
  const [age, setAge] = useState('');
  const [service, setService] = useState<ServiceType>('Acute Care');
  const [priority, setPriority] = useState<Priority>('urgent');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedBayId, setSelectedBayId] = useState<number | null>(null);
  const [lastTicket, setLastTicket] = useState<{
    code: string; name: string; service: ServiceType; priority: Priority; mode: string;
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [admitMode, setAdmitMode] = useState<'queue' | 'bay'>('queue');
  const ticketRef = useRef<HTMLDivElement>(null);

  const formatName = (last: string, first: string) => {
    const l = last.trim();
    const f = first.trim().charAt(0).toUpperCase();
    if (!l) return '';
    return f ? `${l}, ${f}.` : l;
  };

  // Force bay admission for critical/emergent priority or Resuscitation/Trauma service
  const mustAdmitToBay =
    IMMEDIATE_PRIORITIES.includes(priority) || IMMEDIATE_SERVICES.includes(service);

  // Force queue-only for urgent/non-urgent (no direct bay admission allowed)
  const mustUseQueue = !mustAdmitToBay && (priority === 'urgent' || priority === 'non-urgent');

  // Auto-switch mode when rules change
  useEffect(() => {
    if (mustAdmitToBay) {
      setAdmitMode('bay');
    } else if (mustUseQueue) {
      setAdmitMode('queue');
      setSelectedBayId(null);
    }
  }, [mustAdmitToBay, mustUseQueue]);

  // Bays matching the selected service
  const matchingBays = state.counters.filter(
    c => c.service === service && c.isActive
  );

  // When service changes, clear bay selection if the previously selected bay no longer matches
  const handleServiceChange = (s: ServiceType) => {
    setService(s);
    setSelectedBayId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patientName = formatName(lastName, firstInitial);
    if (!patientName || !firstInitial.trim() || !age) return;

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 130) return;
    const complaint = chiefComplaint.trim() || undefined;
    const notesVal = notes.trim() || undefined;

    // Snapshot the counter now so the slip reflects the number the reducer will assign.
    // Because dispatch is synchronous in React, the counter increments atomically — no race.
    const prefix = SERVICE_PREFIXES[service];
    const current = state.ticketCounters[prefix] || 0;
    const ticketCode = `${prefix}-${String(current + 1).padStart(3, '0')}`;

    if ((admitMode === 'bay' || mustAdmitToBay) && selectedBayId !== null) {
      admitToBay(patientName, service, priority, selectedBayId, notesVal, parsedAge, complaint);
      const bayName = state.counters.find(c => c.id === selectedBayId)?.name ?? 'Bay';
      setLastTicket({ code: ticketCode, name: patientName, service, priority, mode: `Assigned → ${bayName}` });
    } else if (!mustAdmitToBay) {
      addTicket(patientName, service, priority, notesVal, parsedAge);
      setLastTicket({ code: ticketCode, name: patientName, service, priority, mode: 'Waiting Queue' });
    } else {
      // mustAdmitToBay but no bay selected — shouldn't reach here due to disabled submit
      return;
    }

    setShowSuccess(true);
    toast.success(`${ticketCode} — ${patientName}`, `${service} · ${priority} · ${admitMode === 'bay' ? 'Bay' : 'Queue'}`);
    setLastName('');
    setFirstInitial('');
    setAge('');
    setChiefComplaint('');
    setNotes('');
    setPriority('urgent');
    setSelectedBayId(null);
    setAdmitMode('queue');
  };

  return (
    <div className="checkin-page">
      <div className="page-header">
        <h1><UserPlus size={28} /> ER Patient Triage</h1>
        <p>Register a new emergency patient</p>
      </div>

      {showSuccess && lastTicket && (
        <div className="ticket-slip-overlay">
          <div className="ticket-slip" ref={ticketRef}>
            <button className="ticket-slip-close" onClick={() => setShowSuccess(false)} title="Close">
              <X size={18} />
            </button>
            <div className="ticket-slip-header">
              <CheckCircle size={22} className="ticket-slip-check" />
              <span>Patient Triaged</span>
            </div>
            <div className="ticket-slip-code" style={{ borderColor: SERVICE_COLORS[lastTicket.service] }}>
              {lastTicket.code}
            </div>
            <div className="ticket-slip-details">
              <div className="ticket-slip-row">
                <span className="ticket-slip-label">Patient</span>
                <span className="ticket-slip-value">{lastTicket.name}</span>
              </div>
              <div className="ticket-slip-row">
                <span className="ticket-slip-label">Area</span>
                <span className="ticket-slip-value" style={{ color: SERVICE_COLORS[lastTicket.service] }}>{lastTicket.service}</span>
              </div>
              <div className="ticket-slip-row">
                <span className="ticket-slip-label">Priority</span>
                <span className={`ticket-slip-value priority-tag ${lastTicket.priority}`}>{lastTicket.priority}</span>
              </div>
              <div className="ticket-slip-row">
                <span className="ticket-slip-label">Placement</span>
                <span className="ticket-slip-value">{lastTicket.mode}</span>
              </div>
              <div className="ticket-slip-row">
                <span className="ticket-slip-label">Time</span>
                <span className="ticket-slip-value">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="ticket-slip-actions">
              <button
                type="button"
                className="ticket-slip-print"
                onClick={() => {
                  const w = window.open('', '_blank', 'width=480,height=640');
                  if (!w) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
                  const priorityColors: Record<string, string> = { critical: '#dc2626', emergent: '#ef4444', urgent: '#f59e0b', 'non-urgent': '#10b981' };
                  const pColor = priorityColors[lastTicket!.priority] ?? '#333';
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Wristband – ${lastTicket!.code}</title>
<style>
  @page { size: 102mm 28mm landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; width: 102mm; height: 28mm; display: flex; align-items: stretch; }
  .band { display: flex; flex-direction: row; width: 100%; border: 1.5px solid #333; border-radius: 4px; overflow: hidden; }
  .band-left { background: ${pColor}; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm 3mm; min-width: 18mm; }
  .band-code { font-size: 8.5pt; font-weight: 900; letter-spacing: 0.04em; text-align: center; }
  .band-priority { font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1mm; border: 1px solid rgba(255,255,255,0.6); padding: 0.5mm 2mm; border-radius: 2px; }
  .band-body { flex: 1; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: space-between; border-left: 1.5px solid #333; }
  .band-name { font-size: 9pt; font-weight: 700; }
  .band-detail { font-size: 7pt; color: #444; }
  .band-footer { font-size: 6pt; color: #888; }
  .band-right { background: #f5f5f5; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; min-width: 12mm; border-left: 1.5px solid #333; }
  .band-hospital { font-size: 5.5pt; color: #555; font-weight: 700; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.08em; }
</style>
</head><body>
<div class="band">
  <div class="band-left">
    <div class="band-code">${lastTicket!.code}</div>
    <div class="band-priority">${lastTicket!.priority}</div>
  </div>
  <div class="band-body">
    <div class="band-name">${lastTicket!.name}</div>
    <div class="band-detail">${lastTicket!.service} &nbsp;|&nbsp; ${lastTicket!.mode}</div>
    <div class="band-footer">${dateStr} &nbsp; ${timeStr}</div>
  </div>
  <div class="band-right"><div class="band-hospital">MediQ ER</div></div>
</div>
</body></html>`);
                  w.document.close(); w.focus();
                  setTimeout(() => w.print(), 300);
                }}
              >
                <Printer size={16} /> Print Wristband
              </button>
              <button type="button" className="ticket-slip-done" onClick={() => setShowSuccess(false)}>
                Done
              </button>
            </div>
            <p className="ticket-slip-hint">Give this code to the patient</p>
          </div>
        </div>
      )}

      <form className="checkin-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g. Johnson"
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group form-group-narrow">
            <label htmlFor="firstInitial">First Initial *</label>
            <input
              id="firstInitial"
              type="text"
              value={firstInitial}
              onChange={e => setFirstInitial(e.target.value.charAt(0).toUpperCase())}
              placeholder="e.g. M"
              maxLength={1}
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group form-group-narrow">
            <label htmlFor="age">Age *</label>
            <input
              id="age"
              type="number"
              min="0"
              max="130"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 34"
              required
              autoComplete="off"
            />
          </div>
        </div>

        {lastName.trim() && (
          <div className="name-preview">
            Patient: <strong>{formatName(lastName, firstInitial)}</strong>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="chief-complaint">Chief Complaint</label>
          <input
            id="chief-complaint"
            type="text"
            value={chiefComplaint}
            onChange={e => setChiefComplaint(e.target.value)}
            placeholder="e.g. Chest pain, fracture, difficulty breathing"
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>ER Area</label>
          <div className="service-grid">
            {SERVICE_TYPES.map(s => (
              <button
                key={s}
                type="button"
                className={`service-btn ${service === s ? 'active' : ''}`}
                style={{ '--svc-color': SERVICE_COLORS[s] } as React.CSSProperties}
                onClick={() => handleServiceChange(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Immediate-care warning banner */}
        {mustAdmitToBay && (
          <div className="immediate-admit-banner">
            <AlertTriangle size={20} />
            <div>
              <strong>Immediate Bay Admission Required</strong>
              <span>
                {IMMEDIATE_PRIORITIES.includes(priority) && IMMEDIATE_SERVICES.includes(service)
                  ? `${priority.toUpperCase()} ${service} patients cannot wait — direct bay admission is mandatory.`
                  : IMMEDIATE_PRIORITIES.includes(priority)
                  ? `${priority.toUpperCase()} patients cannot be placed in the waiting area — assign a bay immediately.`
                  : `${service} patients require immediate bay placement — no waiting queue.`}
              </span>
            </div>
          </div>
        )}

        {/* Admit mode toggle — hidden when bay admission is mandatory OR when queue-only */}
        {!mustAdmitToBay && !mustUseQueue && (
          <div className="form-group">
            <label>Placement</label>
            <div className="admit-mode-toggle">
              <button
                type="button"
                className={`admit-mode-btn ${admitMode === 'queue' ? 'active' : ''}`}
                onClick={() => { setAdmitMode('queue'); setSelectedBayId(null); }}
              >
                <ListOrdered size={16} /> Add to Waiting Queue
              </button>
              <button
                type="button"
                className={`admit-mode-btn ${admitMode === 'bay' ? 'active' : ''}`}
                onClick={() => setAdmitMode('bay')}
              >
                <BedDouble size={16} /> Admit Directly to Bay
              </button>
            </div>
          </div>
        )}

        {/* Bay picker — shown when admit mode is 'bay' and not forced to queue */}
        {admitMode === 'bay' && !mustUseQueue && (
          <div className="form-group">
            <label>Select Bay <span className="label-hint">({service})</span></label>
            {matchingBays.length === 0 ? (
              <p className="bay-picker-empty">No active bays for {service}</p>
            ) : (
              <div className="bay-picker-grid">
                {matchingBays.map(bay => {
                  const free = bay.beds - bay.bedsOccupied;
                  const full = free === 0;
                  const pct = bay.beds > 0 ? Math.round((bay.bedsOccupied / bay.beds) * 100) : 0;
                  return (
                    <button
                      key={bay.id}
                      type="button"
                      disabled={full}
                      className={`bay-picker-card ${
                        selectedBayId === bay.id ? 'selected' : ''
                      } ${full ? 'full' : ''}`}
                      style={{ '--svc-color': SERVICE_COLORS[service] } as React.CSSProperties}
                      onClick={() => setSelectedBayId(bay.id)}
                    >
                      <span className="bay-picker-name">{bay.name}</span>
                      <span className="bay-picker-occ">
                        {bay.bedsOccupied}/{bay.beds}
                        <span className="bay-picker-beds"> beds</span>
                      </span>
                      <div className="bay-picker-bar">
                        <div
                          className="bay-picker-fill"
                          style={{ width: `${pct}%`, background: full ? '#ef4444' : 'var(--svc-color)' }}
                        />
                      </div>
                      {full && <span className="bay-full-tag">FULL</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Triage Level</label>
            <div className="priority-group">
              {(['critical', 'emergent', 'urgent', 'non-urgent'] as Priority[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`priority-btn ${p} ${priority === p ? 'active' : ''}`}
                  style={{ '--triage-color': TRIAGE_COLORS[p] } as React.CSSProperties}
                  onClick={() => setPriority(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="notes">Clinical Notes (optional)</label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Allergies, medications, vitals"
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="submit"
          className={`submit-btn${mustAdmitToBay ? ' submit-btn-urgent' : ''}`}
          disabled={(admitMode === 'bay' || mustAdmitToBay) && selectedBayId === null}
        >
          {admitMode === 'bay' || mustAdmitToBay ? (
            <><BedDouble size={18} /> {mustAdmitToBay && selectedBayId === null ? 'Select a Bay to Admit' : `Admit to ${state.counters.find(c => c.id === selectedBayId)?.name ?? 'Bay'}`}</>
          ) : (
            <><ClipboardPlus size={18} /> Add to Queue</>
          )}
        </button>
      </form>
    </div>
  );
}
