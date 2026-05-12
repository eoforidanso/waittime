import { useState, useEffect, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import type { Priority, ServiceType } from '../types';
import { TRIAGE_COLORS } from '../types';
import { Truck, MapPin, Send, CheckCircle, XCircle, Cross, Navigation2, ChevronDown, ChevronUp } from 'lucide-react';
import AmbulanceMap from '../components/AmbulanceMap';

const HOSPITAL_LS_KEY = 'mediq_hospital_pos';
const DEFAULT_HOSPITAL: [number, number] = [5.6037, -0.1870];
function getHospitalPos(): [number, number] {
  try {
    const raw = localStorage.getItem(HOSPITAL_LS_KEY);
    if (raw) return JSON.parse(raw) as [number, number];
  } catch { /* ignore */ }
  return DEFAULT_HOSPITAL;
}

const CHIEF_COMPLAINTS = [
  'Chest pain',
  'Shortness of breath',
  'Altered mental status',
  'Abdominal pain',
  'Cardiac arrest',
  'Stroke / CVA',
  'Seizure',
  'Major trauma / MVA',
  'Fall with injury',
  'Burns',
  'Penetrating trauma',
  'Head injury / TBI',
  'Spinal injury',
  'Respiratory arrest',
  'Anaphylaxis / allergic reaction',
  'Diabetic emergency',
  'Overdose / poisoning',
  'Obstetric emergency',
  'Pediatric emergency',
  'Psychiatric emergency',
  'Hemorrhage / uncontrolled bleeding',
  'Hypotension / shock',
  'Drowning / near-drowning',
];

// Auto-generate unit number: AMB-001, AMB-002, etc.
function genUnitNumber(existingCount: number): string {
  return `AMB-${String(existingCount + 1).padStart(3, '0')}`;
}

export default function AmbulanceCheckIn() {
  const { state, addAmbulance, addTicket, updateAmbulanceLocation, ambulanceArrived, cancelAmbulance } = useQueue();
  const toast = useToast();
  const [form, setForm] = useState({
    lastName: '',
    firstInitial: '',
    sex: '',
    age: '',
    chiefComplaint: '',
    priority: 'critical' as Priority,
    eta: 10,
    notes: '',
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'tracking' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Format name: "Smith, J."
  const formatName = (last: string, first: string) => {
    const l = last.trim();
    const f = first.trim().charAt(0).toUpperCase();
    if (!l) return '';
    return f ? `${l}, ${f}.` : l;
  };

  // Start GPS tracking
  const startGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    setGpsStatus('tracking');
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  };

  // Keep pushing location updates
  useEffect(() => {
    if (submitted && coords) {
      updateAmbulanceLocation(submitted, coords.lat, coords.lng);
    }
  }, [coords, submitted, updateAmbulanceLocation]);

  // Cleanup GPS watch
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const doSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patientName = formatName(form.lastName, form.firstInitial);
    if (!patientName || !form.chiefComplaint.trim()) return;
    const unitNumber = genUnitNumber(state.ambulances.length);
    const age = form.age ? parseInt(form.age, 10) : undefined;
    addAmbulance(
      unitNumber,
      patientName,
      form.sex || undefined,
      form.chiefComplaint.trim(),
      form.priority,
      form.eta,
      form.notes.trim() || undefined,
      coords?.lat,
      coords?.lng,
      age,
    );
  };

  // Detect newly added ambulance — auto-create pre-alert triage ticket for critical/emergent
  const prevCountRef = useRef(state.ambulances.length);
  useEffect(() => {
    if (state.ambulances.length > prevCountRef.current && submitted === null) {
      const newest = state.ambulances[state.ambulances.length - 1];
      setSubmitted(newest.id);
      toast.warn('Ambulance dispatched', `${newest.unitNumber} — ${newest.patientName} — ETA ${newest.eta}m`);

      // Auto-create a pre-alert triage ticket for critical/emergent patients
      if (newest.priority === 'critical' || newest.priority === 'emergent') {
        const serviceMap: Record<string, ServiceType> = {
          critical:  'Resuscitation',
          emergent:  'Trauma',
        };
        const service: ServiceType = serviceMap[newest.priority] ?? 'Acute Care';
        const ageDisplay = newest.age ? ` (${newest.age}y)` : '';
        addTicket(
          `🚑 PRE-ALERT: ${newest.patientName}${ageDisplay}`,
          service,
          newest.priority,
          `${newest.chiefComplaint}${newest.notes ? ' | ' + newest.notes : ''} | ETA: ${newest.eta} min | Unit: ${newest.unitNumber}`,
          newest.age,
        );
      }
    }
    prevCountRef.current = state.ambulances.length;
  }, [state.ambulances.length]);

  const activeAmb = submitted ? state.ambulances.find(a => a.id === submitted) : null;

  const handleArrived = () => {
    if (!submitted) return;
    ambulanceArrived(submitted);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleCancel = () => {
    if (!submitted) return;
    cancelAmbulance(submitted);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const resetForm = () => {
    setSubmitted(null);
    setForm({ lastName: '', firstInitial: '', sex: '', age: '', chiefComplaint: '', priority: 'critical', eta: 10, notes: '' });
    setCoords(null);
    setGpsStatus('idle');
  };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="amb-checkin">
      <header className="amb-header">
        <div className="amb-brand">
          <Cross size={32} />
          <h1>MediQ</h1>
        </div>
        <div className="amb-header-right">
          <Truck size={24} />
          <span>Ambulance Check-In</span>
        </div>
      </header>

      <div className="amb-timestamp">
        {now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        {' · '}
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </div>

      {!submitted ? (
        <form className="amb-form" onSubmit={doSubmit}>
          <h2><Truck size={22} /> Register Incoming Patient</h2>

          {/* Patient name: last + first initial */}
          <div className="amb-row">
            <div className="amb-field">
              <label>Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="e.g. Johnson"
                required
                autoComplete="off"
              />
            </div>
            <div className="amb-field amb-field-narrow">
              <label>First Initial</label>
              <input
                type="text"
                value={form.firstInitial}
                onChange={e => setForm(f => ({ ...f, firstInitial: e.target.value.charAt(0).toUpperCase() }))}
                placeholder="e.g. M"
                maxLength={1}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Preview formatted name */}
          {form.lastName.trim() && (
            <div className="amb-name-preview">
              Patient: <strong>{formatName(form.lastName, form.firstInitial)}</strong>
            </div>
          )}

          {/* Sex */}
          <div className="amb-field">
            <label>Sex</label>
            <div className="amb-sex-chips">
              {['Male', 'Female'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`amb-sex-chip ${form.sex === s ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, sex: f.sex === s ? '' : s }))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="amb-field amb-field-narrow">
            <label>Age</label>
            <input
              type="number"
              min="0"
              max="150"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              placeholder="e.g. 45"
              autoComplete="off"
            />
          </div>

          {/* Chief complaint with datalist */}
          <div className="amb-field">
            <label>Chief Complaint</label>
            <input
              type="text"
              list="cc-list"
              value={form.chiefComplaint}
              onChange={e => setForm(f => ({ ...f, chiefComplaint: e.target.value }))}
              placeholder="Select or type complaint…"
              required
              autoComplete="off"
            />
            <datalist id="cc-list">
              {CHIEF_COMPLAINTS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Priority — critical and emergent only */}
          <div className="amb-row">
            <div className="amb-field">
              <label>Triage Priority</label>
              <div className="amb-priority-chips">
                {(['critical', 'emergent'] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`amb-priority-chip ${form.priority === p ? 'active' : ''}`}
                    style={{
                      borderColor: TRIAGE_COLORS[p],
                      background: form.priority === p ? TRIAGE_COLORS[p] : 'transparent',
                      color: form.priority === p ? '#fff' : TRIAGE_COLORS[p],
                    }}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="amb-field">
              <label>ETA (minutes)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={form.eta}
                onChange={e => setForm(f => ({ ...f, eta: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="amb-field">
            <label>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details for ER staff…"
              rows={2}
            />
          </div>

          <div className="amb-gps-section">
            <h3><MapPin size={18} /> GPS Tracking</h3>
            {gpsStatus === 'idle' && (
              <button type="button" className="btn-gps" onClick={startGPS}>
                <Navigation2 size={16} /> Enable GPS Tracking
              </button>
            )}
            {gpsStatus === 'tracking' && (
              <div className="gps-active-block">
                <div className="gps-active">
                  <span className="gps-dot" />
                  GPS Active — transmitting to ER
                  {coords && <span className="gps-coords">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>}
                </div>
                <button type="button" className="btn-toggle-minimap" onClick={() => setShowMiniMap(v => !v)}>
                  <MapPin size={13} /> {showMiniMap ? 'Hide Map' : 'Show Map'}
                  {showMiniMap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {coords && showMiniMap && (
                  <div className="amb-mini-map">
                    <AmbulanceMap
                      ambulances={[]}
                      hospitalPos={getHospitalPos()}
                      now={now}
                      mini
                      singlePos={[coords.lat, coords.lng]}
                      singleLabel={`${formatName(form.lastName, form.firstInitial) || 'Patient'}`}
                    />
                  </div>
                )}
              </div>
            )}
            {gpsStatus === 'error' && (
              <div className="gps-error">GPS unavailable &mdash; location won't be shared</div>
            )}
          </div>

          <button type="submit" className="btn-amb-submit">
            <Send size={18} /> Dispatch Alert to ER
          </button>
        </form>
      ) : activeAmb ? (
        <div className="amb-tracking-card">
          <div className={`amb-status-banner ${activeAmb.status}`}>
            {activeAmb.status === 'en-route' && 'ðŸš‘ EN ROUTE'}
            {activeAmb.status === 'arrived' && 'âœ… ARRIVED'}
            {activeAmb.status === 'cancelled' && 'âŒ CANCELLED'}
          </div>

          <div className="amb-tracking-info">
            <div className="amb-info-row">
              <strong>Unit:</strong> {activeAmb.unitNumber}
            </div>
            <div className="amb-info-row">
              <strong>Patient:</strong> {activeAmb.patientName}
            </div>
            {activeAmb.sex && (
              <div className="amb-info-row">
                <strong>Sex:</strong> {activeAmb.sex}
              </div>
            )}
            {activeAmb.age != null && (
              <div className="amb-info-row">
                <strong>Age:</strong> {activeAmb.age} yrs
              </div>
            )}
            <div className="amb-info-row">
              <strong>Complaint:</strong> {activeAmb.chiefComplaint}
            </div>
            <div className="amb-info-row">
              <strong>Priority:</strong>
              <span className="amb-triage-tag" style={{ background: TRIAGE_COLORS[activeAmb.priority] }}>
                {activeAmb.priority}
              </span>
            </div>
            <div className="amb-info-row">
              <strong>ETA:</strong> {activeAmb.eta} min
            </div>
            {coords && (
              <>
                <div className="amb-info-row">
                  <strong>Location:</strong>
                  <span className="gps-coords">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                  <span className="gps-dot" />
                </div>
                <button type="button" className="btn-toggle-minimap" onClick={() => setShowMiniMap(v => !v)}>
                  <MapPin size={13} /> {showMiniMap ? 'Hide Map' : 'Show Map'}
                  {showMiniMap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {showMiniMap && (
                  <div className="amb-mini-map">
                    <AmbulanceMap
                      ambulances={[]}
                      hospitalPos={getHospitalPos()}
                      now={now}
                      mini
                      singlePos={[coords.lat, coords.lng]}
                      singleLabel={`${activeAmb.unitNumber} — ${activeAmb.patientName}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {activeAmb.status === 'en-route' && (
            <div className="amb-tracking-actions">
              <button className="btn-amb-arrived" onClick={handleArrived}>
                <CheckCircle size={18} /> Mark Arrived
              </button>
              <button className="btn-amb-cancel" onClick={handleCancel}>
                <XCircle size={18} /> Cancel
              </button>
            </div>
          )}

          {activeAmb.status !== 'en-route' && (
            <button className="btn-amb-new" onClick={resetForm}>
              <Truck size={16} /> New Check-In
            </button>
          )}
        </div>
      ) : (
        <div className="amb-tracking-card">
          <p>Ambulance dispatched. <button className="btn-amb-new" onClick={resetForm}>New Check-In</button></p>
        </div>
      )}
    </div>
  );
}
