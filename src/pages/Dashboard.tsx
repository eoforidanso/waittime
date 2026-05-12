import { useState, useMemo } from 'react';
import { useQueue } from '../context/QueueContext';
import { SERVICE_COLORS, TRIAGE_COLORS, SERVICE_TYPES } from '../types';
import type { Priority } from '../types';
import { WaitTimer, LiveAvgWait, formatTriageTime } from '../utils/waitTime';
import LiveClock from '../components/LiveClock';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  Stethoscope,
  Printer,
  BedDouble,
  ChevronDown,
  CheckCircle,
  XCircle,
  Building2,
  Siren,
  ShieldAlert,
} from 'lucide-react';

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, emergent: 1, urgent: 2, 'non-urgent': 3 };

export default function Dashboard() {
  const { state, getStats, recallTicket, completeTicket, noShow } = useQueue();
  const stats = getStats();
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  // ── ER wait data ───────────────────────────────────────────────────────────
  const waitingCreatedAts = state.tickets
    .filter(t => t.status === 'waiting')
    .map(t => t.createdAt);
  const completedWaits = state.tickets
    .filter(t => (t.status === 'completed' || t.status === 'serving') && t.calledAt && t.createdAt)
    .map(t => (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);

  // ── ER Census ──────────────────────────────────────────────────────────────
  const activeER = state.tickets.filter(t => t.status === 'waiting' || t.status === 'serving');

  const triageCensus = useMemo(() =>
    (['critical', 'emergent', 'urgent', 'non-urgent'] as Priority[]).map(level => ({
      level,
      count: activeER.filter(t => t.priority === level).length,
    })), [activeER]);

  const areaCensus = useMemo(() =>
    SERVICE_TYPES.map(area => ({
      area,
      total: activeER.filter(t => t.service === area).length,
      waiting: activeER.filter(t => t.service === area && t.status === 'waiting').length,
      serving: activeER.filter(t => t.service === area && t.status === 'serving').length,
    })), [activeER]);

  // ── Bay / Bed stats ────────────────────────────────────────────────────────
  const totalBays = state.counters.length;
  const occupiedBays = state.counters.filter(c => c.currentTicket).length;
  const activeBays = state.counters.filter(c => c.isActive).length;
  const bayPct = totalBays > 0 ? Math.round((occupiedBays / totalBays) * 100) : 0;

  const totalERBeds = state.counters.reduce((s, c) => s + c.beds, 0);
  const occupiedERBeds = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
  const erBedPct = totalERBeds > 0 ? Math.round((occupiedERBeds / totalERBeds) * 100) : 0;

  // ── Nurses ─────────────────────────────────────────────────────────────────
  const nursesOnDuty = state.nurses.filter(n => n.onDuty).length;
  const nursesTotal = state.nurses.length;
  const nurseRatio = nursesOnDuty > 0 ? (activeER.length / nursesOnDuty).toFixed(1) : '—';

  // ── Inpatient ──────────────────────────────────────────────────────────────
  const inpatientStats = useMemo(() => {
    let total = 0, occupied = 0, available = 0, cleaning = 0;
    for (const u of state.inpatientUnits) {
      for (const b of u.beds) {
        total++;
        if (b.status === 'occupied') occupied++;
        else if (b.status === 'available') available++;
        else if (b.status === 'cleaning') cleaning++;
      }
    }
    return { total, occupied, available, cleaning, pct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [state.inpatientUnits]);

  // ── Escalations ────────────────────────────────────────────────────────────
  const openEscalations = state.escalationLog.filter(e => !e.resolved);
  const critEscal = openEscalations.filter(e => e.severity === 'critical').length;

  // ── Ambulances ─────────────────────────────────────────────────────────────
  const enRouteAmbs = state.ambulances.filter(a => a.status === 'en-route');

  // ── Live queues ────────────────────────────────────────────────────────────
  const waitingQueue = useMemo(() =>
    state.tickets
      .filter(t => t.status === 'waiting')
      .sort((a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ), [state.tickets]);

  const recentServing = useMemo(() =>
    state.tickets
      .filter(t => t.status === 'serving')
      .sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime()),
    [state.tickets]);

  const recentCompleted = useMemo(() =>
    state.tickets
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 6),
    [state.tickets]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const ringDash = (pct: number) => `${pct * 2.51} 251`;
  const ringColor = (pct: number) => pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="dashboard-page">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title"><LayoutDashboard size={26} /> Hospital Command Dashboard</h1>
          <p className="dash-subtitle">Real-time overview · Emergency &amp; Inpatient</p>
        </div>
        <div className="dash-header-right">
          {critEscal > 0 && (
            <div className="dash-crit-alert">
              <ShieldAlert size={15} />
              {critEscal} critical alert{critEscal > 1 ? 's' : ''}
            </div>
          )}
          <span className="live-indicator"><span className="live-dot" /> LIVE</span>
          <LiveClock />
          <button className="btn-print" onClick={() => window.print()} title="Print dashboard">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="dash-kpi-strip">
        <div className="dash-kpi-card" style={{ borderTopColor: '#3b82f6' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}><Users size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val">{stats.totalWaiting}</div>
            <div className="dash-kpi-label">ER Waiting</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#f59e0b' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><UserCheck size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val">{stats.totalServing}</div>
            <div className="dash-kpi-label">Serving</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#10b981' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><CheckCircle2 size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val">{stats.totalCompleted}</div>
            <div className="dash-kpi-label">Completed</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#8b5cf6' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}><Clock size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val dash-kpi-sm">
              <LiveAvgWait waitingCreatedAts={waitingCreatedAts} completedWaits={completedWaits} />
            </div>
            <div className="dash-kpi-label">Avg Wait</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: erBedPct > 90 ? '#ef4444' : '#a5b4fc' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(165,180,252,0.12)', color: '#a5b4fc' }}><BedDouble size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val" style={{ color: erBedPct > 90 ? '#ef4444' : undefined }}>{erBedPct}%</div>
            <div className="dash-kpi-label">ER Beds</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: inpatientStats.pct > 90 ? '#ef4444' : '#6366f1' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}><Building2 size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val" style={{ color: inpatientStats.pct > 90 ? '#ef4444' : undefined }}>{inpatientStats.pct}%</div>
            <div className="dash-kpi-label">Inpatient</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: nursesOnDuty < 5 ? '#ef4444' : '#10b981' }}>
          <div className="dash-kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><Stethoscope size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val" style={{ color: nursesOnDuty < 5 ? '#ef4444' : undefined }}>
              {nursesOnDuty}<span className="dash-kpi-total">/{nursesTotal}</span>
            </div>
            <div className="dash-kpi-label">On Duty</div>
          </div>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: openEscalations.length > 0 ? '#ef4444' : '#475569' }}>
          <div className="dash-kpi-icon" style={{
            background: openEscalations.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(71,85,105,0.12)',
            color: openEscalations.length > 0 ? '#ef4444' : '#94a3b8',
          }}><AlertTriangle size={20} /></div>
          <div className="dash-kpi-body">
            <div className="dash-kpi-val" style={{ color: openEscalations.length > 0 ? '#ef4444' : '#94a3b8' }}>{openEscalations.length}</div>
            <div className="dash-kpi-label">Escalations</div>
          </div>
        </div>
      </div>

      {/* ── Main 3-column grid ────────────────────────────────────────────── */}
      <div className="dash-main">

        {/* ── COL 1: ER Overview ── */}
        <div className="dash-col">

          {/* Occupancy rings */}
          <div className="dash-panel">
            <div className="dash-panel-title"><Activity size={14} /> ER Occupancy</div>
            <div className="dash-rings-row">
              <div className="dash-ring-wrap">
                <div className="dash-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none"
                      stroke={ringColor(bayPct)} strokeWidth="10"
                      strokeDasharray={ringDash(bayPct)} strokeLinecap="round"
                      transform="rotate(-90 50 50)" />
                  </svg>
                  <span className="dash-ring-pct" style={{ color: ringColor(bayPct) }}>{bayPct}%</span>
                </div>
                <div className="dash-ring-label">
                  <span className="dash-ring-title">Bay Occ.</span>
                  <span className="dash-ring-sub">{occupiedBays}/{totalBays} bays</span>
                  <span className="dash-ring-sub">{activeBays} active</span>
                </div>
              </div>
              <div className="dash-ring-wrap">
                <div className="dash-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none"
                      stroke={ringColor(erBedPct)} strokeWidth="10"
                      strokeDasharray={ringDash(erBedPct)} strokeLinecap="round"
                      transform="rotate(-90 50 50)" />
                  </svg>
                  <span className="dash-ring-pct" style={{ color: ringColor(erBedPct) }}>{erBedPct}%</span>
                </div>
                <div className="dash-ring-label">
                  <span className="dash-ring-title">Bed Occ.</span>
                  <span className="dash-ring-sub">{occupiedERBeds}/{totalERBeds} beds</span>
                  <span className={`dash-ring-sub${totalERBeds - occupiedERBeds <= 3 ? ' dash-low' : ''}`}>
                    {totalERBeds - occupiedERBeds} free
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Triage breakdown */}
          <div className="dash-panel">
            <div className="dash-panel-title"><ShieldAlert size={14} /> Triage Level</div>
            <div className="dash-triage-list">
              {triageCensus.map(t => (
                <div key={t.level} className="dash-triage-row">
                  <span className="dash-triage-dot" style={{ background: TRIAGE_COLORS[t.level] }} />
                  <span className="dash-triage-label">{t.level}</span>
                  <div className="dash-triage-bar-track">
                    <div className="dash-triage-bar-fill" style={{
                      width: activeER.length > 0 ? `${(t.count / activeER.length) * 100}%` : '0%',
                      background: TRIAGE_COLORS[t.level],
                    }} />
                  </div>
                  <span className="dash-triage-count" style={{ color: TRIAGE_COLORS[t.level] }}>{t.count}</span>
                </div>
              ))}
              {activeER.length === 0 && <p className="empty-text" style={{ padding: '0.35rem 0', margin: 0 }}>No active patients</p>}
            </div>
          </div>

          {/* ER by Area */}
          <div className="dash-panel">
            <div className="dash-panel-title"><Activity size={14} /> ER by Area</div>
            <div className="dash-area-list">
              {areaCensus.filter(a => a.total > 0).map(a => (
                <div key={a.area} className="dash-area-row">
                  <span className="dash-area-dot" style={{ background: SERVICE_COLORS[a.area] }} />
                  <span className="dash-area-name">{a.area}</span>
                  <span className="dash-area-total">{a.total}</span>
                  <span className="dash-area-chips">
                    <span className="dash-chip-wait">{a.waiting}w</span>
                    <span className="dash-chip-serve">{a.serving}s</span>
                  </span>
                </div>
              ))}
              {areaCensus.every(a => a.total === 0) && (
                <p className="empty-text" style={{ margin: 0 }}>No patients in ER</p>
              )}
            </div>
          </div>

          {/* Nurse summary */}
          <div className="dash-panel">
            <div className="dash-panel-title"><Stethoscope size={14} /> Staffing</div>
            <div className="dash-nurse-row">
              <div className="dash-nurse-big" style={{ color: nursesOnDuty < 5 ? '#ef4444' : '#10b981' }}>
                {nursesOnDuty}
              </div>
              <div className="dash-nurse-meta">
                <span>of {nursesTotal} nurses on duty</span>
                <span className="dash-nurse-ratio">Patient:Nurse — {nurseRatio}:1</span>
              </div>
            </div>
            {state.nurses.filter(n => n.onDuty).length > 0 && (
              <div className="dash-nurse-list">
                {state.nurses.filter(n => n.onDuty).slice(0, 5).map(n => (
                  <div key={n.id} className="dash-nurse-item">
                    <span className="dash-nurse-dot" />
                    <span className="dash-nurse-name">{n.name}</span>
                    <span className="dash-nurse-area">{n.assignedArea}</span>
                  </div>
                ))}
                {state.nurses.filter(n => n.onDuty).length > 5 && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                    +{state.nurses.filter(n => n.onDuty).length - 5} more on duty
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── COL 2: Live Activity ── */}
        <div className="dash-col">

          {/* Waiting queue */}
          <div className="dash-panel" style={{ flex: 1 }}>
            <div className="dash-panel-title">
              <Users size={14} /> Waiting Queue
              <span className="dash-panel-badge">{waitingQueue.length} patients</span>
            </div>
            {waitingQueue.length === 0 ? (
              <p className="empty-text" style={{ margin: 0 }}>No patients waiting</p>
            ) : (
              <div className="dash-queue-list">
                {waitingQueue.map((t, i) => {
                  const serviceBays = state.counters.filter(c => c.service === t.service && c.isActive);
                  const isOpen = assignTarget === t.id;
                  return (
                    <div key={t.id}>
                      <div className={`dash-queue-item ${t.priority}`}>
                        <span className="dash-queue-pos">{i + 1}</span>
                        <div className="dash-queue-info">
                          <strong>{t.patientName}</strong>
                          <small>
                            {t.service} · triaged {formatTriageTime(t.triagedAt)} ·{' '}
                            <WaitTimer since={t.createdAt} />
                          </small>
                        </div>
                        <span className={`priority-tag ${t.priority}`} style={{ fontSize: '0.6rem' }}>
                          {t.priority}
                        </span>
                        <button
                          className={`btn-assign-bay${isOpen ? ' open' : ''}`}
                          style={{ fontSize: '0.68rem', padding: '3px 7px', flexShrink: 0 }}
                          onClick={() => setAssignTarget(isOpen ? null : t.id)}
                        >
                          <BedDouble size={11} /> Bay <ChevronDown size={10} />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="assign-bay-picker">
                          <span className="assign-bay-label">Move {t.patientName} to bay:</span>
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
                                  onClick={() => { recallTicket(t.id, bay.id); setAssignTarget(null); }}
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
          </div>

          {/* Now Serving */}
          <div className="dash-panel">
            <div className="dash-panel-title">
              <UserCheck size={14} /> Now Serving
              <span className="dash-panel-badge">{recentServing.length}</span>
            </div>
            {recentServing.length === 0 ? (
              <p className="empty-text" style={{ margin: 0 }}>No patients in bays</p>
            ) : (
              <div className="dash-serving-list">
                {recentServing.map(t => (
                  <div key={t.id} className="dash-serving-item">
                    <span className="ticket-badge" style={{ background: SERVICE_COLORS[t.service], fontSize: '0.68rem', padding: '3px 7px' }}>
                      {t.ticketNumber}
                    </span>
                    <div className="dash-serving-info">
                      <strong>{t.patientName}</strong>
                      <small>Bay {t.counterNumber} · <WaitTimer since={t.calledAt!} /></small>
                    </div>
                    <div className="serving-item-btns">
                      <button className="btn-serve-action complete" title="Complete" onClick={() => completeTicket(t.id)}>
                        <CheckCircle size={13} />
                      </button>
                      <button className="btn-serve-action noshow" title="No-show" onClick={() => noShow(t.id)}>
                        <XCircle size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recently Completed */}
          <div className="dash-panel">
            <div className="dash-panel-title"><CheckCircle2 size={14} /> Recently Completed</div>
            {recentCompleted.length === 0 ? (
              <p className="empty-text" style={{ margin: 0 }}>None yet today</p>
            ) : (
              <div className="dash-completed-list">
                {recentCompleted.map(t => (
                  <div key={t.id} className="dash-completed-item">
                    <span className="ticket-badge muted" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>{t.ticketNumber}</span>
                    <span className="dash-completed-name">{t.patientName}</span>
                    <span className="dash-completed-service" style={{ color: SERVICE_COLORS[t.service] }}>{t.service}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── COL 3: Hospital Wide ── */}
        <div className="dash-col">

          {/* Inpatient wards */}
          <div className="dash-panel" style={{ flex: 1 }}>
            <div className="dash-panel-title">
              <Building2 size={14} /> Inpatient Wards
              <span className="dash-panel-badge">{inpatientStats.occupied}/{inpatientStats.total} beds</span>
            </div>

            {/* Overall inpatient ring + chips */}
            <div className="dash-ipt-overview">
              <div className="dash-ring" style={{ width: 60, height: 60, flexShrink: 0 }}>
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke={inpatientStats.pct > 90 ? '#ef4444' : inpatientStats.pct > 75 ? '#f59e0b' : '#6366f1'}
                    strokeWidth="12"
                    strokeDasharray={ringDash(inpatientStats.pct)} strokeLinecap="round"
                    transform="rotate(-90 50 50)" />
                </svg>
                <span className="dash-ring-pct" style={{
                  fontSize: '0.85rem',
                  color: inpatientStats.pct > 90 ? '#ef4444' : inpatientStats.pct > 75 ? '#f59e0b' : '#6366f1',
                }}>
                  {inpatientStats.pct}%
                </span>
              </div>
              <div className="dash-ipt-chips">
                <span className="dash-ipt-chip dash-ipt-occ">{inpatientStats.occupied} occupied</span>
                <span className="dash-ipt-chip dash-ipt-avail">{inpatientStats.available} available</span>
                <span className="dash-ipt-chip dash-ipt-clean">{inpatientStats.cleaning} cleaning</span>
              </div>
            </div>

            {/* Per-ward bars */}
            <div className="dash-ward-list">
              {state.inpatientUnits.map(u => {
                const occ = u.beds.filter(b => b.status === 'occupied').length;
                const pct = u.beds.length > 0 ? Math.round((occ / u.beds.length) * 100) : 0;
                const barColor = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : u.color;
                return (
                  <div key={u.id} className="dash-ward-row">
                    <span className="dash-ward-abbr" style={{ color: u.color }}>{u.abbreviation}</span>
                    <div className="dash-ward-bar-wrap">
                      <div className="dash-ward-bar">
                        <div className="dash-ward-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                    <span className="dash-ward-count">{occ}/{u.beds.length}</span>
                    <span className="dash-ward-pct" style={{ color: barColor }}>{pct}%</span>
                  </div>
                );
              })}
              {state.inpatientUnits.length === 0 && (
                <p className="empty-text" style={{ margin: 0 }}>No wards configured</p>
              )}
            </div>
          </div>

          {/* Escalations */}
          <div className="dash-panel">
            <div className="dash-panel-title" style={{ color: openEscalations.length > 0 ? '#ef4444' : undefined }}>
              <AlertTriangle size={14} /> Escalations
              <span className="dash-panel-badge" style={{ color: openEscalations.length > 0 ? '#ef4444' : undefined }}>
                {openEscalations.length} open
              </span>
            </div>
            {openEscalations.length === 0 ? (
              <p className="empty-text" style={{ margin: 0, color: '#10b981' }}>✓ No open escalations</p>
            ) : (
              <div className="dash-escal-list">
                {openEscalations.slice(0, 4).map(e => (
                  <div key={e.id} className={`dash-escal-item dash-escal-${e.severity}`}>
                    <div className="dash-escal-top">
                      <span className="dash-escal-sev">{e.severity}</span>
                      <span className="dash-escal-title">{e.title}</span>
                    </div>
                    <div className="dash-escal-meta">{e.area} · {e.author}</div>
                  </div>
                ))}
                {openEscalations.length > 4 && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', margin: '2px 0 0' }}>
                    +{openEscalations.length - 4} more — see Escalation Log
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Ambulances en route */}
          <div className="dash-panel">
            <div className="dash-panel-title" style={{ color: enRouteAmbs.length > 0 ? '#f59e0b' : undefined }}>
              <Siren size={14} /> Ambulances En Route
              <span className="dash-panel-badge">{enRouteAmbs.length}</span>
            </div>
            {enRouteAmbs.length === 0 ? (
              <p className="empty-text" style={{ margin: 0 }}>No ambulances currently en route</p>
            ) : (
              <div className="dash-amb-list">
                {enRouteAmbs.map(a => (
                  <div key={a.id} className={`dash-amb-item priority-${a.priority}`}>
                    <div className="dash-amb-header">
                      <span className="dash-amb-unit">🚑 {a.unitNumber}</span>
                      <span className="dash-amb-eta">ETA {a.eta}m</span>
                    </div>
                    <div className="dash-amb-body">
                      <span className="dash-amb-patient">{a.patientName}</span>
                      {a.chiefComplaint && <span className="dash-amb-complaint">{a.chiefComplaint}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

