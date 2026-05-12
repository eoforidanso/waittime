/**
 * Plays an ambulance wail siren for 30 seconds using the Web Audio API.
 * Returns a stop() function for early cancellation.
 */
export function playDispatchAlert(): () => void {
  try {
    const ctx = new AudioContext();
    const DURATION = 30;   // seconds
    const CYCLE   = 2.8;   // seconds per full wail sweep (up + down)
    const LOW_FREQ  = 660; // Hz — bottom of the sweep
    const HIGH_FREQ = 1560; // Hz — top of the sweep

    // Master gain with fade-in and fade-out
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 0.35);
    master.gain.setValueAtTime(0.42, ctx.currentTime + DURATION - 1.2);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + DURATION);
    master.connect(ctx.destination);

    // Low-pass filter softens the raw sawtooth into a horn-like siren timbre
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.8;
    filter.connect(master);

    // Sawtooth oscillator — characteristic siren waveform
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';

    // Schedule the sweeping frequency ramps for the full duration
    let t = ctx.currentTime;
    osc.frequency.setValueAtTime(LOW_FREQ, t);
    const cycles = Math.ceil(DURATION / CYCLE) + 1;
    for (let i = 0; i < cycles; i++) {
      osc.frequency.linearRampToValueAtTime(HIGH_FREQ, t + CYCLE / 2);
      osc.frequency.linearRampToValueAtTime(LOW_FREQ, t + CYCLE);
      t += CYCLE;
    }

    osc.connect(filter);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + DURATION);

    const autoClose = setTimeout(() => ctx.close(), (DURATION + 0.5) * 1000);

    // Return a stop handle so callers can cut the siren short if needed
    return () => {
      clearTimeout(autoClose);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        setTimeout(() => ctx.close(), 450);
      } catch { /* already closed */ }
    };
  } catch {
    return () => {};
  }
}

/**
 * Plays the ambulance siren in a continuous loop until the returned stop() is called.
 * Each 30-second cycle restarts automatically.
 */
export function playLoopingSiren(): () => void {
  let stopped = false;
  let stopCurrent: (() => void) | null = null;
  let nextTimer: ReturnType<typeof setTimeout> | null = null;

  function startCycle() {
    if (stopped) return;
    stopCurrent = playDispatchAlert();
    // 30s cycle — restart just before auto-close so there's no gap
    nextTimer = setTimeout(() => {
      if (!stopped) startCycle();
    }, 29500);
  }

  startCycle();

  return () => {
    stopped = true;
    if (nextTimer !== null) clearTimeout(nextTimer);
    stopCurrent?.();
  };
}

/** Softer single confirmation beep (used on the check-in side) */
export function playConfirmBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    env.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 600);
  } catch {
    // silent fallback
  }
}
