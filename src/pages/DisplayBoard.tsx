import { useEffect, useState, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { SERVICE_COLORS } from '../types';
import { WaitTimer, formatTriageTime } from '../utils/waitTime';
import { Volume2 } from 'lucide-react';

export default function DisplayBoard() {
  const { state } = useQueue();
  const [flash, setFlash] = useState<string | null>(null);

  const nowServing = state.tickets
    .filter(t => t.status === 'serving')
    .sort((a, b) => new Date(b.calledAt ?? 0).getTime() - new Date(a.calledAt ?? 0).getTime());

  const waiting = state.tickets
    .filter(t => t.status === 'waiting')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Initialise with IDs already serving on first render — prevents re-announcing stale tickets on mount
  const seenIdsRef = useRef<Set<string>>(new Set(nowServing.map(t => t.id)));

  // Flash when a genuinely new ticket enters "serving" state (not already there on load)
  useEffect(() => {
    const currentIdSet = new Set(nowServing.map(t => t.id));
    const newIds = [...currentIdSet].filter(id => !seenIdsRef.current.has(id));
    seenIdsRef.current = currentIdSet;
    if (newIds.length === 0) return;
    const newTicket = nowServing.find(t => t.id === newIds[0]);
    if (!newTicket) return;
    setFlash(newTicket.id);
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [nowServing.map(t => t.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-speak only when flash is set (i.e. a new ticket just arrived)
  useEffect(() => {
    if (!flash) return;
    const ticket = nowServing.find(t => t.id === flash);
    if (!ticket) return;
    if ('speechSynthesis' in window) {
      // Cancel any queued announcements so stale tickets don't play out of order
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(
        `Now serving ticket ${ticket.ticketNumber.replace('-', ' ')} at bay ${ticket.counterNumber}. ${ticket.patientName}, please proceed.`
      );
      msg.rate = 0.9;
      msg.pitch = 1;
      window.speechSynthesis.speak(msg);
    }
  }, [flash]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="display-board">
      <div className="display-header">
        <h1>🏥 MediQ</h1>
        <span className="live-badge"><span className="pulse" /> LIVE</span>
      </div>

      <div className="display-grid">
        {/* Now Serving - Main */}
        <div className="now-serving-section">
          <h2><Volume2 size={22} /> Now Serving</h2>
          {nowServing.length === 0 ? (
            <div className="display-empty">
              <p>No patients being served</p>
            </div>
          ) : (
            <div className="now-serving-cards">
              {nowServing.map(t => (
                <div
                  key={t.id}
                  className={`now-serving-card ${flash === t.id ? 'flash' : ''}`}
                  style={{ borderLeftColor: SERVICE_COLORS[t.service] }}
                >
                  <div className="ns-ticket" style={{ background: SERVICE_COLORS[t.service] }}>
                    {t.ticketNumber}
                  </div>
                  <div className="ns-detail">
                    <span className="ns-name">{t.patientName}</span>
                    <span className="ns-counter">Bay {t.counterNumber}</span>
                  </div>
                  <div className="ns-meta">
                    <span className="ns-service">{t.service}</span>
                    <span className="ns-wait">Triaged {formatTriageTime(t.triagedAt)} · Wait: <WaitTimer since={t.createdAt} /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiting List */}
        <div className="waiting-section">
          <h2>Waiting ({waiting.length})</h2>
          <div className="waiting-list-display">
            {waiting.slice(0, 20).map((t, i) => (
              <div key={t.id} className={`waiting-row ${t.priority === 'critical' || t.priority === 'emergent' ? 'highlight' : ''}`}>
                <span className="wr-pos">{i + 1}</span>
                <span className="wr-ticket" style={{ color: SERVICE_COLORS[t.service] }}>
                  {t.ticketNumber}
                </span>
                <span className="wr-name">{t.patientName}</span>
                <span className="wr-triage">{formatTriageTime(t.triagedAt)}</span>
                <span className="wr-wait"><WaitTimer since={t.createdAt} /></span>
                <span className="wr-service">{t.service}</span>
              </div>
            ))}
            {waiting.length > 20 && (
              <p className="more-waiting">+{waiting.length - 20} more waiting...</p>
            )}
          </div>
        </div>
      </div>

      <div className="display-footer">
        <CurrentTime />
      </div>
    </div>
  );
}

function CurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="clock">
      {time.toLocaleTimeString()} — {time.toLocaleDateString()}
    </span>
  );
}
