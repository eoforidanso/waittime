import { useEffect, useRef, useState } from 'react';
import { Siren, X, VolumeX } from 'lucide-react';
import { useQueue } from '../context/QueueContext';
import { playLoopingSiren } from '../utils/alertSound';
import { TRIAGE_COLORS } from '../types';
import type { Ambulance } from '../types';

/**
 * Global ambulance siren alert — mounted in StaffLayout so it persists across
 * all pages. Plays a looping siren when new ambulances go en-route, shows a
 * fixed banner with patient info, and keeps ringing until a user hits "Stop Siren".
 */
export default function AmbulanceSirenAlert() {
  const { state } = useQueue();
  const [alerts, setAlerts] = useState<Ambulance[]>([]);
  const stopSirenRef = useRef<(() => void) | null>(null);
  const prevEnRouteRef = useRef<string[]>(
    state.ambulances.filter(a => a.status === 'en-route').map(a => a.id),
  );

  useEffect(() => {
    const currentEnRoute = state.ambulances.filter(a => a.status === 'en-route');
    const newOnes = currentEnRoute.filter(a => !prevEnRouteRef.current.includes(a.id));

    if (newOnes.length > 0) {
      setAlerts(prev => {
        // avoid duplicates if effect fires twice (StrictMode)
        const existingIds = new Set(prev.map(a => a.id));
        return [...prev, ...newOnes.filter(a => !existingIds.has(a.id))];
      });

      // Restart looping siren for every new dispatch
      stopSirenRef.current?.();
      stopSirenRef.current = playLoopingSiren();
    }

    prevEnRouteRef.current = currentEnRoute.map(a => a.id);
  // Use a stable string key so the effect only re-runs when ambulance IDs/statuses actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ambulances.map(a => `${a.id}:${a.status}`).join(',')]);

  // Stop siren if component unmounts (e.g. user logs out)
  useEffect(() => {
    return () => {
      stopSirenRef.current?.();
    };
  }, []);

  const dismiss = (id: string) => {
    setAlerts(prev => {
      const remaining = prev.filter(a => a.id !== id);
      if (remaining.length === 0) {
        stopSirenRef.current?.();
        stopSirenRef.current = null;
      }
      return remaining;
    });
  };

  const stopAll = () => {
    stopSirenRef.current?.();
    stopSirenRef.current = null;
    setAlerts([]);
  };

  if (alerts.length === 0) return null;

  return (
    <div className="global-siren-overlay">
      <div className="global-siren-header">
        <span className="global-siren-title">
          <Siren size={17} className="siren-spin-icon" />
          {alerts.length} Ambulance{alerts.length > 1 ? 's' : ''} Incoming
        </span>
        <button className="global-siren-stop" onClick={stopAll}>
          <VolumeX size={14} /> Stop Siren
        </button>
      </div>

      {alerts.map(a => (
        <div key={a.id} className={`amb-alert-card priority-${a.priority}`} style={{ margin: '0 0 0.5rem' }}>
          <div className="amb-alert-siren"><Siren size={20} /></div>
          <div className="amb-alert-body">
            <div className="amb-alert-title">
              <span className="amb-unit">{a.unitNumber}</span>
              <span className="amb-patient">
                {a.patientName}
                {a.sex ? ` (${a.sex[0].toUpperCase()})` : ''}
                {a.age ? `, ${a.age} yrs` : ''}
              </span>
            </div>
            <div className="amb-alert-detail">
              <span className="amb-complaint">{a.chiefComplaint}</span>
              <span className="amb-eta">ETA {a.eta} min</span>
              <span
                className="amb-priority-tag"
                style={{ background: TRIAGE_COLORS[a.priority] }}
              >
                {a.priority.toUpperCase()}
              </span>
            </div>
            {a.notes && <div className="amb-alert-notes">{a.notes}</div>}
          </div>
          <button className="amb-dismiss-btn" onClick={() => dismiss(a.id)} title="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
