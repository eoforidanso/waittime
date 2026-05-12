import { useState, useEffect, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { TRIAGE_COLORS, SERVICE_TYPES, SERVICE_COLORS } from '../types';
import type { ServiceType } from '../types';
import AmbulanceMap from '../components/AmbulanceMap';
import { LiveAvgWait, getElapsedMinutes } from '../utils/waitTime';
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Navigation,
  LocateFixed,
  Users,
  Bed,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const DEFAULT_HOSPITAL: [number, number] = [5.6037, -0.1870]; // Accra, Ghana fallback
const LS_KEY = 'mediq_hospital_pos';

function loadHospitalPos(): [number, number] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as [number, number];
  } catch { /* ignore */ }
  return DEFAULT_HOSPITAL;
}

export default function AmbulanceTracker() {
  const { state, ambulanceArrived, cancelAmbulance } = useQueue();
  const [now, setNow] = useState(new Date());
  const [hospitalPos, setHospitalPos] = useState<[number, number]>(loadHospitalPos);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showERStatus, setShowERStatus] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; priority: string }[]>([]);
  const prevAmbCountRef = useRef(state.ambulances.filter(a => a.status === 'en-route').length);
  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── ER Status derived data ──────────────────────────────────────
  const waiting = state.tickets.filter(t => t.status === 'waiting');
  const serving  = state.tickets.filter(t => t.status === 'serving');
  const totalInER = waiting.length + serving.length;
  const totalBeds = state.counters.reduce((s, c) => s + c.beds, 0);
  const occupiedBeds = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
  const availableBeds = totalBeds - occupiedBeds;
  const allBedsFullAlert = availableBeds === 0 && totalBeds > 0;
  const waitingCreatedAts = waiting.map(t => t.createdAt);
  const completedWaits = state.tickets
    .filter(t => (t.status === 'completed' || t.status === 'serving') && t.calledAt && t.createdAt)
    .map(t => (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);
  const areaCounts = SERVICE_TYPES.reduce((acc, area) => {
    acc[area] = state.tickets.filter(t => t.service === area && (t.status === 'waiting' || t.status === 'serving')).length;
    return acc;
  }, {} as Record<ServiceType, number>);
  const triageCounts = {
    critical:    waiting.filter(t => t.priority === 'critical').length,
    emergent:    waiting.filter(t => t.priority === 'emergent').length,
    urgent:      waiting.filter(t => t.priority === 'urgent').length,
    'non-urgent': waiting.filter(t => t.priority === 'non-urgent').length,
  };

  // Fire alert when a new en-route ambulance is added
  useEffect(() => {
    const currentEnRoute = state.ambulances.filter(a => a.status === 'en-route');
    if (currentEnRoute.length > prevAmbCountRef.current) {
      const newest = currentEnRoute[currentEnRoute.length - 1];
      const id = Date.now();
      setToasts(t => [...t, {
        id,
        msg: `🚑 ${newest.unitNumber} — ${newest.patientName}${newest.sex ? ` (${newest.sex[0]})` : ''} · ${newest.chiefComplaint} · ETA ${newest.eta} min`,
        priority: newest.priority,
      }]);
      // Auto-dismiss after 8s
      const timer = setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 8000);
      toastTimersRef.current.push(timer);
    }
    prevAmbCountRef.current = currentEnRoute.length;
  }, [state.ambulances]);

  // Clear all pending toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const enRoute = state.ambulances.filter(a => a.status === 'en-route');
  const arrived = state.ambulances.filter(a => a.status === 'arrived');
  const cancelled = state.ambulances.filter(a => a.status === 'cancelled');
  const withGps = enRoute.filter(a => a.lat != null && a.lng != null);

  const setHospitalHere = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setHospitalPos(p);
        localStorage.setItem(LS_KEY, JSON.stringify(p));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getElapsed = (date: Date) => {
    const ms = now.getTime() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return '<1m ago';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const getETACountdown = (amb: typeof enRoute[0]) => {
    const elapsed = (now.getTime() - new Date(amb.dispatchedAt).getTime()) / 60000;
    const remaining = Math.max(0, amb.eta - elapsed);
    if (remaining < 1) return 'Arriving now';
    return `~${Math.ceil(remaining)} min`;
  };

  return (
    <div className="amb-tracker-page">

      {/* Dispatch toast notifications */}
      <div className="dispatch-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`dispatch-toast priority-${t.priority}`}>
            <AlertTriangle size={18} />
            <span>{t.msg}</span>
            <button className="toast-close" onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>

      <div className="page-header">
        <div className="page-header-top">
          <h1><Truck size={28} /> Ambulance Tracker</h1>
          <div className="tracker-header-actions">
            <button
              className={`btn-locate ${locating ? 'locating' : ''}`}
              onClick={setHospitalHere}
              title="Set hospital position to this device's location"
              disabled={locating}
            >
              <LocateFixed size={15} />
              {locating ? 'Locating…' : 'Set Hospital Pin'}
            </button>
            <button
              className={`btn-toggle-map ${showMap ? 'active' : ''}`}
              onClick={() => setShowMap(v => !v)}
            >
              <MapPin size={15} />
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          </div>
        </div>
        <p>Real-time GPS map · {withGps.length}/{enRoute.length} ambulances transmitting GPS</p>
      </div>

      {/* ── Always-visible ER quick-stats strip ── */}
      <div className="tracker-stats-strip">
        <div className={`tracker-stat-pill${allBedsFullAlert ? ' alert' : ''}`}>
          <Bed size={15} />
          <span className="tsp-val">{availableBeds}</span>
          <span className="tsp-lbl">/ {totalBeds} beds free</span>
        </div>
        <div className="tracker-stat-pill">
          <Users size={15} />
          <span className="tsp-val">{totalInER}</span>
          <span className="tsp-lbl">patients in ER</span>
        </div>
        <div className="tracker-stat-pill">
          <Clock size={15} />
          <span className="tsp-val">
            <LiveAvgWait waitingCreatedAts={waitingCreatedAts} completedWaits={completedWaits} />
          </span>
          <span className="tsp-lbl">avg wait</span>
        </div>
        <div className="tracker-stat-pill">
          <AlertTriangle size={15} />
          <span className="tsp-val">{enRoute.length}</span>
          <span className="tsp-lbl">en route</span>
        </div>
      </div>

      {/* ── ER Status Panel ─────────────────────────────────── */}
      <div className={`er-status-panel${allBedsFullAlert ? ' er-status-alert' : ''}`}>
        <button className="er-status-toggle" onClick={() => setShowERStatus(v => !v)}>
          <span><Activity size={16} /> ER Status</span>
          <span className="er-status-badges">
            <span className={`er-badge${allBedsFullAlert ? ' alert' : ''}`}>{totalInER} patients</span>
            <span className={`er-badge${allBedsFullAlert ? ' alert' : ''}`}>{availableBeds}/{totalBeds} beds free</span>
          </span>
          {showERStatus ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showERStatus && (
          <div className="er-status-body">
            {/* Stat row */}
            <div className="er-stat-row">
              <div className={`er-stat-card${allBedsFullAlert ? ' er-stat-alert' : ''}`}>
                <Users size={20} />
                <div>
                  <div className="er-stat-val">{totalInER}</div>
                  <div className="er-stat-lbl">Patients in ER</div>
                  <div className="er-stat-sub">{waiting.length} waiting · {serving.length} being seen</div>
                </div>
              </div>
              <div className="er-stat-card">
                <Clock size={20} />
                <div>
                  <div className="er-stat-val">
                    <LiveAvgWait waitingCreatedAts={waitingCreatedAts} completedWaits={completedWaits} />
                  </div>
                  <div className="er-stat-lbl">Avg Wait</div>
                  <div className="er-stat-sub">Estimated from queue</div>
                </div>
              </div>
              <div className={`er-stat-card${allBedsFullAlert ? ' er-stat-alert' : ''}`}>
                <Bed size={20} />
                <div>
                  <div className="er-stat-val">{availableBeds}<span className="er-stat-total">/{totalBeds}</span></div>
                  <div className="er-stat-lbl">Beds Available</div>
                  <div className="er-stat-sub">{occupiedBeds} occupied · {totalBeds} total</div>
                </div>
              </div>
            </div>

            {/* Breakdowns */}
            <div className="er-breakdown-row">
              <div className="er-breakdown-col">
                <div className="er-breakdown-title"><Activity size={13} /> By Area</div>
                {SERVICE_TYPES.map(area => (
                  <div key={area} className="er-breakdown-item">
                    <span className="er-dot" style={{ background: SERVICE_COLORS[area] }} />
                    <span className="er-breakdown-name">{area}</span>
                    <span className="er-breakdown-count">{areaCounts[area]}</span>
                  </div>
                ))}
              </div>
              <div className="er-breakdown-col">
                <div className="er-breakdown-title">Triage (waiting)</div>
                {(['critical', 'emergent', 'urgent', 'non-urgent'] as const).map(level => (
                  <div key={level} className="er-breakdown-item">
                    <span className="er-dot" style={{ background: TRIAGE_COLORS[level] }} />
                    <span className="er-breakdown-name">{level}</span>
                    <span className="er-breakdown-count">{triageCounts[level]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Map */}
      {showMap && (
        <div className="tracker-map-panel">
          <AmbulanceMap
            ambulances={state.ambulances}
            hospitalPos={hospitalPos}
            now={now}
          />
          {enRoute.length > 0 && withGps.length === 0 && (
            <div className="map-no-gps-overlay">
              <Navigation size={24} />
              <span>No ambulances transmitting GPS yet.<br />Awaiting location data from field devices.</span>
            </div>
          )}
        </div>
      )}

      {/* En-route section */}
      <section className="amb-section">
        <h2 className="amb-section-title en-route">
          <AlertTriangle size={20} />
          En Route ({enRoute.length})
        </h2>
        {enRoute.length === 0 ? (
          <div className="amb-empty">No ambulances currently en route</div>
        ) : (
          <div className="amb-cards">
            {enRoute.map(amb => (
              <div key={amb.id} className={`amb-card priority-${amb.priority}`}>
                <div className="amb-card-header">
                  <div className="amb-unit">
                    <Truck size={20} />
                    <strong>{amb.unitNumber}</strong>
                  </div>
                  <span className="amb-triage-tag" style={{ background: TRIAGE_COLORS[amb.priority] }}>
                    {amb.priority}
                  </span>
                </div>

                <div className="amb-card-body">
                  <div className="amb-detail">
                    <span className="amb-label">Patient</span>
                    <span>{amb.patientName}{amb.sex ? <span className="amb-sex-tag">{amb.sex[0]}</span> : null}{amb.age != null ? <span className="amb-age-tag">{amb.age}y</span> : null}</span>
                  </div>
                  <div className="amb-detail">
                    <span className="amb-label">Complaint</span>
                    <span>{amb.chiefComplaint}</span>
                  </div>
                  <div className="amb-detail">
                    <span className="amb-label">ETA</span>
                    <span className="amb-eta">{getETACountdown(amb)}</span>
                  </div>
                  <div className="amb-detail">
                    <span className="amb-label">Dispatched</span>
                    <span>{getElapsed(amb.dispatchedAt)}</span>
                  </div>
                  <div className="amb-detail amb-gps-live">
                    <span className="amb-label"><Navigation size={14} /> GPS</span>
                    {amb.lat != null && amb.lng != null ? (
                      <span>
                        <span className="gps-dot" />
                        {amb.lat.toFixed(5)}, {amb.lng.toFixed(5)}
                        {amb.lastLocationUpdate && (
                          <small className="gps-updated"> · updated {getElapsed(amb.lastLocationUpdate)}</small>
                        )}
                      </span>
                    ) : (
                      <span className="gps-waiting">Awaiting signal…</span>
                    )}
                  </div>
                  {amb.notes && (
                    <div className="amb-detail">
                      <span className="amb-label">Notes</span>
                      <span>{amb.notes}</span>
                    </div>
                  )}
                </div>

                <div className="amb-card-actions">
                  <button className="btn-amb-arrived" onClick={() => ambulanceArrived(amb.id)}>
                    <CheckCircle2 size={16} /> Mark Arrived
                  </button>
                  <button className="btn-amb-cancel" onClick={() => cancelAmbulance(amb.id)}>
                    <XCircle size={16} /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Arrived section */}
      {arrived.length > 0 && (
        <section className="amb-section">
          <h2 className="amb-section-title arrived">
            <CheckCircle2 size={20} />
            Arrived ({arrived.length})
          </h2>
          <div className="amb-cards">
            {arrived.map(amb => (
              <div key={amb.id} className="amb-card arrived">
                <div className="amb-card-header">
                  <div className="amb-unit">
                    <Truck size={20} />
                    <strong>{amb.unitNumber}</strong>
                  </div>
                  <span className="amb-arrived-badge"><CheckCircle2 size={14} /> Arrived</span>
                </div>
                <div className="amb-card-body">
                  <div className="amb-detail">
                    <span className="amb-label">Patient</span>
                    <span>{amb.patientName}{amb.sex ? <span className="amb-sex-tag">{amb.sex[0]}</span> : null}{amb.age != null ? <span className="amb-age-tag">{amb.age}y</span> : null}</span>
                  </div>
                  <div className="amb-detail">
                    <span className="amb-label">Complaint</span>
                    <span>{amb.chiefComplaint}</span>
                  </div>
                  <div className="amb-detail">
                    <span className="amb-label">Arrived</span>
                    <span>{amb.arrivedAt ? new Date(amb.arrivedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cancelled section */}
      {cancelled.length > 0 && (
        <section className="amb-section">
          <h2 className="amb-section-title cancelled">
            <XCircle size={20} />
            Cancelled ({cancelled.length})
          </h2>
          <div className="amb-cards compact">
            {cancelled.map(amb => (
              <div key={amb.id} className="amb-card cancelled">
                <span><Truck size={16} /> {amb.unitNumber}</span>
                <span>{amb.patientName}</span>
                <span className="amb-cancelled-tag">Cancelled</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
