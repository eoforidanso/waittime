import { useQueue } from '../context/QueueContext';
import { LiveAvgWait } from '../utils/waitTime';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Cross, Users, Clock, Bed, Music, VolumeX } from 'lucide-react';

// Calming hospital ambient chords (Cmaj7 → Fmaj7 → Am7 → G6)
const CHORDS_HZ = [
  [261.63, 329.63, 392.00, 493.88],   // Cmaj7
  [349.23, 440.00, 523.25, 659.25],   // Fmaj7
  [220.00, 261.63, 329.63, 392.00],   // Am7
  [196.00, 246.94, 293.66, 369.99],   // G6
];

function scheduleAmbient(ctx: AudioContext, master: GainNode, stopRef: { current: boolean }): () => void {
  let chordIdx = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const playChord = () => {
    if (stopRef.current || ctx.state === 'closed') return;
    const chord = CHORDS_HZ[chordIdx % CHORDS_HZ.length];
    chordIdx++;

    try {
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Mix sine + triangle for a soft piano-pad timbre
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2.5);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 7);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 10);

        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 11);
      });
    } catch {
      // AudioContext was closed between the check and the call — stop scheduling
      return;
    }

    timerId = setTimeout(playChord, 8000);
  };

  playChord();

  // Return a cancel function so the caller can stop the loop without waiting for stopRef
  return () => {
    if (timerId !== null) clearTimeout(timerId);
  };
}

export default function PatientView() {
  const { state } = useQueue();
  const [now, setNow] = useState(new Date());
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopRef = useRef(false);
  const startedRef = useRef(false);
  const cancelAmbientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startAudio = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    stopRef.current = false;

    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.2, ctx.currentTime);
      master.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = master;
      setAudioBlocked(false);
      cancelAmbientRef.current = scheduleAmbient(ctx, master, stopRef);
    } catch {
      // Audio API not available
    }
  }, []);

  // Try on mount; browsers may allow it without a gesture
  useEffect(() => {
    const tryAutoplay = async () => {
      // AudioContext requires a gesture on many browsers — check state first
      const ctx = new AudioContext();
      if (ctx.state === 'running') {
        ctx.close();
        startAudio();
      } else {
        ctx.close();
        setAudioBlocked(true);
      }
    };
    tryAutoplay();
  }, [startAudio]);

  // Capture first user interaction if blocked
  useEffect(() => {
    if (!audioBlocked) return;
    const handler = () => startAudio();
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [audioBlocked, startAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current = true;
      cancelAmbientRef.current?.();
      audioCtxRef.current?.close();
    };
  }, []);

  const toggleMute = () => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const newMuted = !muted;
    setMuted(newMuted);
    masterGainRef.current.gain.linearRampToValueAtTime(
      newMuted ? 0 : 0.2,
      audioCtxRef.current.currentTime + 0.3
    );
  };

  const waiting = state.tickets.filter(t => t.status === 'waiting');
  const serving = state.tickets.filter(t => t.status === 'serving');
  const totalInER = waiting.length + serving.length;

  // Bed capacity
  const totalBeds = state.counters.reduce((s, c) => s + c.beds, 0);
  const occupiedBeds = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
  const availableBeds = totalBeds - occupiedBeds;

  // For LiveAvgWait
  const waitingCreatedAts = waiting.map(t => t.createdAt);
  const completedWaits = state.tickets
    .filter(t => (t.status === 'completed' || t.status === 'serving') && t.calledAt && t.createdAt)
    .map(t => (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);

  // Per-area counts — kept for future use
  // const areaCounts = ...

  // Triage breakdown — kept for future use
  // const triageCounts = ...

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <div className="patient-view">
      {/* Click-to-enable prompt shown when browser blocks autoplay */}
      {audioBlocked && (
        <div className="pv-audio-prompt" onClick={() => startAudio()}>
          <Music size={16} />
          <span>Click anywhere to enable music</span>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="pv-orb pv-orb-1" />
      <div className="pv-orb pv-orb-2" />
      <div className="pv-orb pv-orb-3" />
      <div className="pv-orb pv-orb-4" />
      <div className="pv-particles">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="pv-particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <header className="pv-header">
        <div className="pv-brand">
          <Cross size={36} />
          <h1>MediQ</h1>
        </div>
        <div className="pv-header-right">
          <button className="pv-music-btn" onClick={toggleMute} title={muted ? 'Unmute music' : 'Mute music'}>
            {muted ? <VolumeX size={20} /> : <Music size={20} />}
          </button>
          <div className="pv-timestamp">
            <div className="pv-date">{dateStr}</div>
            <div className="pv-time">{timeStr}</div>
          </div>
        </div>
      </header>

      <div className="pv-hero">
        <div className={`pv-stat-card pv-patients${availableBeds === 0 ? ' pv-alert' : ''}`}>
          <Users size={40} />
          <div className="pv-stat-value" key={totalInER}>
            <span className="pv-num-pop">{totalInER}</span>
          </div>
          <div className="pv-stat-label">Patients in ER</div>
          <div className="pv-stat-sub">{waiting.length} waiting · {serving.length} being seen</div>
        </div>
        <div className="pv-stat-card pv-wait">
          <Clock size={40} />
          <div className="pv-stat-value">
            <LiveAvgWait
              waitingCreatedAts={waitingCreatedAts}
              completedWaits={completedWaits}
            />
          </div>
          <div className="pv-stat-label">Average Wait Time</div>
          <div className="pv-stat-sub">Estimated from current queue</div>
        </div>
        <div className={`pv-stat-card pv-beds${availableBeds === 0 ? ' pv-alert' : ''}`}>
          <Bed size={40} />
          <div className="pv-stat-value" key={availableBeds}>
            <span className="pv-num-pop">{availableBeds}</span><span className="pv-stat-total">/{totalBeds}</span>
          </div>
          <div className="pv-stat-label">Beds Available</div>
          <div className="pv-stat-sub">{occupiedBeds} occupied · {totalBeds} total capacity</div>
        </div>
      </div>

      <footer className="pv-footer">
        <p>Patients are seen based on triage priority, not arrival order.</p>
        <p className="pv-footer-sub">If you're experiencing a life-threatening emergency, call <strong>911</strong>.</p>
      </footer>
    </div>
  );
}
