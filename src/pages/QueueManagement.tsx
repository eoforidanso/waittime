import { useState, useEffect, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { ServiceType, TicketStatus } from '../types';
import { SERVICE_TYPES, SERVICE_COLORS, TRIAGE_COLORS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from '../types';
import type { Ambulance } from '../types';
import { WaitTimer, formatTriageTime } from '../utils/waitTime';
import { BreachCountdown } from '../utils/breachTimer';
import { playDispatchAlert } from '../utils/alertSound';
import {
  MonitorPlay,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Bell,
  Skull,
  Siren,
  X,
  BedDouble,
  ChevronDown,
  Tag,
  Building2,
} from 'lucide-react';

export default function QueueManagement() {
  const { state, callNext, completeTicket, noShow, markDeceased, transferTicket, recallTicket, updateTicketStatus, admitToInpatient } = useQueue();
  const toast = useToast();
  const { confirm, Dialog: ConfirmEl } = useConfirm();
  const [selectedCounter, setSelectedCounter] = useState<number | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ ticketId: string; show: boolean }>({ ticketId: '', show: false });
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<string | null>(null); // ticketId for status picker
  const [inpatientModal, setInpatientModal] = useState<{ ticketId: string; show: boolean }>({ ticketId: '', show: false });
  const [selectedInpatientBed, setSelectedInpatientBed] = useState<{ unitId: string; bedId: string } | null>(null);
  const [ambAlerts, setAmbAlerts] = useState<Ambulance[]>([]);
  const stopSirenRef = useRef<(() => void) | null>(null);
  const prevEnRouteRef = useRef<string[]>(
    state.ambulances.filter(a => a.status === 'en-route').map(a => a.id)
  );

  // Detect newly dispatched ambulances and fire alert
  useEffect(() => {
    const currentEnRoute = state.ambulances.filter(a => a.status === 'en-route');
    const newOnes = currentEnRoute.filter(a => !prevEnRouteRef.current.includes(a.id));
    if (newOnes.length > 0) {
      setAmbAlerts(prev => [...prev, ...newOnes]);
      // Stop any existing siren and start fresh
      stopSirenRef.current?.();
      stopSirenRef.current = playDispatchAlert();
    }
    prevEnRouteRef.current = currentEnRoute.map(a => a.id);
  }, [state.ambulances]);

  const dismissAlert = (id: string) => {
    setAmbAlerts(prev => {
      const remaining = prev.filter(a => a.id !== id);
      if (remaining.length === 0) {
        stopSirenRef.current?.();
        stopSirenRef.current = null;
      }
      return remaining;
    });
  };

  const dismissAll = () => {
    stopSirenRef.current?.();
    stopSirenRef.current = null;
    setAmbAlerts([]);
  };

  const activeCounters = state.counters.filter(c => c.isActive);
  const counter = activeCounters.find(c => c.id === selectedCounter);

  const waitingForCounter = counter
    ? state.tickets
        .filter(t => t.service === counter.service && t.status === 'waiting')
        .sort((a, b) => {
          const po = { critical: 0, emergent: 1, urgent: 2, 'non-urgent': 3 } as const;
          if (po[a.priority] !== po[b.priority]) return po[a.priority] - po[b.priority];
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
    : [];

  const handleTransfer = (ticketId: string, newService: ServiceType) => {
    transferTicket(ticketId, newService);
    toast.info('Patient transferred', newService);
    setTransferTarget({ ticketId: '', show: false });
  };

  const handleAssignToBay = (ticketId: string, counterId: number) => {
    const t = state.tickets.find(t => t.id === ticketId);
    const bay = state.counters.find(c => c.id === counterId);
    recallTicket(ticketId, counterId);
    toast.success(`Assigned to ${bay?.name ?? 'Bay'}`, t?.patientName ?? '');
    setAssignTarget(null);
  };

  return (
    <div className="queue-mgmt-page">
      <div className="page-header">
        <h1><MonitorPlay size={28} /> ER Queue Management</h1>
        <p>Manage patients from your bay</p>
      </div>

      {/* Ambulance incoming alerts */}
      {ambAlerts.length > 0 && (
        <div className="amb-alert-stack">
          <div className="amb-alert-stack-header">
            <span><Siren size={16} /> {ambAlerts.length} Ambulance{ambAlerts.length > 1 ? 's' : ''} Incoming</span>
            <button className="amb-dismiss-all" onClick={dismissAll}><X size={14} /> Dismiss All</button>
          </div>
          {ambAlerts.map(a => (
            <div key={a.id} className={`amb-alert-card priority-${a.priority}`}>
              <div className="amb-alert-siren"><Siren size={22} /></div>
              <div className="amb-alert-body">
                <div className="amb-alert-title">
                  <span className="amb-unit">{a.unitNumber}</span>
                  <span className="amb-patient">{a.patientName}{a.sex ? ` (${a.sex[0].toUpperCase()})` : ''}{a.age ? `, ${a.age} yrs` : ''}</span>
                </div>
                <div className="amb-alert-detail">
                  <span className="amb-complaint">{a.chiefComplaint}</span>
                  <span className="amb-eta">ETA {a.eta} min</span>
                  <span className="amb-priority-tag" style={{ background: TRIAGE_COLORS[a.priority] }}>{a.priority.toUpperCase()}</span>
                </div>
                {a.notes && <div className="amb-alert-notes">{a.notes}</div>}
              </div>
              <button className="amb-dismiss-btn" onClick={() => dismissAlert(a.id)} title="Dismiss"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Counter selector */}
      <div className="counter-selector">
        <label>Select Your Bay:</label>
        <div className="counter-chips">
          {activeCounters.map(c => (
            <button
              key={c.id}
              className={`counter-chip ${selectedCounter === c.id ? 'active' : ''}`}
              onClick={() => setSelectedCounter(c.id)}
            >
              {c.name}
              <small>{c.service}</small>
            </button>
          ))}
        </div>
      </div>

      {counter && (
        <div className="queue-workspace">
          {/* Current patient */}
          <div className="current-patient-card">
            <h3>Currently Serving</h3>
            {counter.currentTicket ? (
              <div className="current-ticket">
                <div className="ticket-number-large" style={{ background: SERVICE_COLORS[counter.currentTicket.service] }}>
                  {counter.currentTicket.ticketNumber}
                </div>
                <div className="patient-info">
                  <h2>{counter.currentTicket.patientName}</h2>
                  {counter.currentTicket.age != null && (
                    <p>Age: <strong>{counter.currentTicket.age} yrs</strong></p>
                  )}
                  <p className="service-tag" style={{ color: SERVICE_COLORS[counter.currentTicket.service] }}>
                    {counter.currentTicket.service}
                  </p>
                  <span className={`priority-indicator ${counter.currentTicket.priority}`}>
                    Triage: {counter.currentTicket.priority.toUpperCase()}
                  </span>
                  <p className="triage-timestamp">Triaged at {formatTriageTime(counter.currentTicket.triagedAt)}</p>
                  <p className="wait-elapsed">Waiting: <WaitTimer since={counter.currentTicket.createdAt} className="timer" /></p>
                  {counter.currentTicket.calledAt && (
                    <p className="wait-elapsed bay-time">In Bay: <WaitTimer since={counter.currentTicket.calledAt} className="timer bay-timer" /></p>
                  )}
                  <div className="breach-row">
                    <span className="breach-label">Target:</span>
                    <BreachCountdown triagedAt={counter.currentTicket.triagedAt} priority={counter.currentTicket.priority} />
                  </div>
                  {counter.currentTicket.notes && (
                    <p className="notes">Notes: {counter.currentTicket.notes}</p>
                  )}
                </div>
                <div className="action-buttons">
                  <button className="btn-complete" onClick={() => { completeTicket(counter.currentTicket!.id); toast.success('Patient completed', counter.currentTicket!.patientName); }}>
                    <CheckCircle size={16} /> Complete
                  </button>
                  <button className="btn-noshow" onClick={() => { noShow(counter.currentTicket!.id); toast.warn('Marked no-show', counter.currentTicket!.patientName); }}>
                    <XCircle size={16} /> No-Show
                  </button>
                  <button className="btn-deceased" onClick={async () => {
                    const ok = await confirm({
                      title: 'Mark Patient Deceased',
                      message: `Are you sure you want to mark ${counter.currentTicket!.patientName} (${counter.currentTicket!.ticketNumber}) as deceased? This action cannot be undone.`,
                      confirmLabel: 'Confirm Deceased',
                      variant: 'danger',
                    });
                    if (ok) { markDeceased(counter.currentTicket!.id); toast.error('Patient marked deceased', counter.currentTicket!.patientName); }
                  }}>
                    <Skull size={16} /> Deceased
                  </button>
                  <button className="btn-transfer" onClick={() => setTransferTarget({ ticketId: counter.currentTicket!.id, show: true })}>
                    <ArrowRightLeft size={16} /> Transfer
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button className="btn-transfer" onClick={() => setStatusTarget(s => s === counter.currentTicket!.id ? null : counter.currentTicket!.id)}>
                      <Tag size={16} /> Status
                    </button>
                    {statusTarget === counter.currentTicket!.id && (
                      <div className="status-picker">
                        {(['results-pending','awaiting-bed','referred','discharged','admitted'] as TicketStatus[]).map(s => (
                          <button key={s} className="status-pick-btn"
                            style={{ background: TICKET_STATUS_COLORS[s] + '22', borderColor: TICKET_STATUS_COLORS[s], color: TICKET_STATUS_COLORS[s] }}
                            onClick={() => { updateTicketStatus(counter.currentTicket!.id, s); setStatusTarget(null); }}
                          >
                            {TICKET_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-transfer"
                    style={{ background: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: '#10b981' }}
                    onClick={() => { setInpatientModal({ ticketId: counter.currentTicket!.id, show: true }); setSelectedInpatientBed(null); }}
                  >
                    <Building2 size={16} /> Admit to Ward
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-patient">
                <p>No patient currently being served</p>
                <button
                  className="btn-call-next"
                  onClick={() => callNext(counter.id)}
                  disabled={waitingForCounter.length === 0}
                >
                  <Bell size={18} /> Call Next Patient
                </button>
              </div>
            )}
          </div>

          {/* Queue for this service */}
          <div className="waiting-queue-card">
            <h3>Waiting Queue — {counter.service} ({waitingForCounter.length})</h3>
            {waitingForCounter.length === 0 ? (
              <p className="empty-text">No patients waiting</p>
            ) : (
              <div className="queue-list">
                {waitingForCounter.map((t, i) => {
                  const serviceBays = state.counters.filter(c => c.service === t.service && c.isActive);
                  const isOpen = assignTarget === t.id;
                  return (
                    <div key={t.id} className="queue-item-wrap">
                      <div className={`queue-item ${t.priority}`}>
                        <span className="queue-pos">{i + 1}</span>
                        <span className="ticket-badge" style={{ background: SERVICE_COLORS[t.service] }}>
                          {t.ticketNumber}
                        </span>
                        <div className="queue-patient-info">
                            <strong>{t.patientName}</strong>
                          <small>Triaged {formatTriageTime(t.triagedAt)} · Wait: <WaitTimer since={t.createdAt} /></small>
                          <BreachCountdown triagedAt={t.triagedAt} priority={t.priority} className="breach-inline" />
                        </div>
                        <span className={`priority-tag ${t.priority}`}>{t.priority}</span>
                        <button
                          className={`btn-assign-bay${isOpen ? ' open' : ''}`}
                          onClick={() => setAssignTarget(isOpen ? null : t.id)}
                          title="Move to bay"
                        >
                          <BedDouble size={14} /> Move to Bay <ChevronDown size={12} />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="assign-bay-picker">
                          <span className="assign-bay-label">Select bay for {t.patientName}:</span>
                          <div className="assign-bay-chips">
                            {serviceBays.length === 0 && (
                              <span className="assign-bay-empty">No active bays for {t.service}</span>
                            )}
                            {serviceBays.map(bay => {
                              const free = bay.beds - bay.bedsOccupied;
                              const full = free <= 0;
                              return (
                                <button
                                  key={bay.id}
                                  className={`assign-bay-chip${full ? ' full' : ''}`}
                                  disabled={full}
                                  onClick={() => handleAssignToBay(t.id, bay.id)}
                                >
                                  <span className="abc-name">{bay.name}</span>
                                  <span className={`abc-beds${full ? ' full' : ''}`}>
                                    {full ? 'FULL' : `${free} free`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!counter.currentTicket && waitingForCounter.length > 0 && (
              <button className="btn-call-next mt" onClick={() => callNext(counter.id)}>
                <Bell size={18} /> Call Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferTarget.show && (
        <div className="modal-overlay" onClick={() => setTransferTarget({ ticketId: '', show: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Transfer Patient To</h3>
            <div className="transfer-options">
              {SERVICE_TYPES.filter(s => counter && s !== counter.service).map(s => (
                <button
                  key={s}
                  className="transfer-option"
                  style={{ borderColor: SERVICE_COLORS[s] }}
                  onClick={() => handleTransfer(transferTarget.ticketId, s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button className="btn-cancel" onClick={() => setTransferTarget({ ticketId: '', show: false })}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {ConfirmEl}

      {/* Inpatient ward admission modal */}
      {inpatientModal.show && (() => {
        const ticket = state.tickets.find(t => t.id === inpatientModal.ticketId);
        if (!ticket) return null;
        return (
          <div className="modal-overlay" onClick={() => { setInpatientModal({ ticketId: '', show: false }); setSelectedInpatientBed(null); }}>
            <div className="modal ipt-modal ipt-modal-wide" onClick={e => e.stopPropagation()}>
              <div className="ipt-modal-header">
                <h3><Building2 size={20} /> Admit to Inpatient Ward</h3>
                <button className="ipt-modal-close" onClick={() => { setInpatientModal({ ticketId: '', show: false }); setSelectedInpatientBed(null); }}><X size={18} /></button>
              </div>
              <p className="ipt-modal-sub">
                Admitting <strong>{ticket.patientName}</strong>{ticket.age ? ` (${ticket.age}y)` : ''} from <strong>{ticket.service}</strong>.
                Select an available inpatient bed.
              </p>
              <div className="ipt-transfer-units">
                {state.inpatientUnits.map(u => {
                  const availBeds = u.beds.filter(b => b.status === 'available');
                  if (availBeds.length === 0) return null;
                  return (
                    <div key={u.id} className="ipt-transfer-unit">
                      <div className="ipt-transfer-unit-name" style={{ color: u.color }}>{u.abbreviation} — {u.name}</div>
                      <div className="ipt-transfer-beds">
                        {availBeds.map(b => (
                          <button
                            key={b.id}
                            className={`ipt-transfer-bed-btn${selectedInpatientBed?.bedId === b.id ? ' selected' : ''}`}
                            style={{ borderColor: selectedInpatientBed?.bedId === b.id ? u.color : undefined }}
                            onClick={() => setSelectedInpatientBed({ unitId: u.id, bedId: b.id })}
                          >
                            {b.bedNumber}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {state.inpatientUnits.every(u => u.beds.every(b => b.status !== 'available')) && (
                  <p style={{ color: '#ef4444', padding: '16px' }}>No available inpatient beds at this time.</p>
                )}
              </div>
              <div className="ipt-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => { setInpatientModal({ ticketId: '', show: false }); setSelectedInpatientBed(null); }}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedInpatientBed}
                  onClick={() => {
                    if (!selectedInpatientBed) return;
                    admitToInpatient(
                      selectedInpatientBed.unitId,
                      selectedInpatientBed.bedId,
                      ticket.patientName,
                      'ER',
                      ticket.age,
                      ticket.id,
                      ticket.chiefComplaint,
                    );
                    const unit = state.inpatientUnits.find(u => u.id === selectedInpatientBed.unitId);
                    const bed = unit?.beds.find(b => b.id === selectedInpatientBed.bedId);
                    toast.success(`Admitted to ${unit?.name ?? 'ward'}`, `${ticket.patientName} → ${bed?.bedNumber ?? ''}`);
                    setInpatientModal({ ticketId: '', show: false });
                    setSelectedInpatientBed(null);
                  }}
                >
                  Confirm Admission
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
