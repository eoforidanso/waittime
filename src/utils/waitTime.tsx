import { useState, useEffect, useRef } from 'react';

/** Format a duration in minutes to "Xh Ym" or "Ym" */
export function formatWaitTime(minutes: number): string {
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format a Date as a short time string e.g. "2:35 PM" */
export function formatTriageTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Get live elapsed minutes since a given date */
export function getElapsedMinutes(since: Date): number {
  return (Date.now() - new Date(since).getTime()) / 60000;
}

/** A live-updating timer that shows elapsed time since `since` */
export function WaitTimer({ since, className }: { since: Date; className?: string }) {
  const [elapsed, setElapsed] = useState(() => getElapsedMinutes(since));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedMinutes(since));
    }, 10000); // update every 10s
    return () => clearInterval(interval);
  }, [since]);

  return <span className={className}>{formatWaitTime(elapsed)}</span>;
}

/** Live-updating average wait time across waiting + completed patients */
export function LiveAvgWait({ waitingCreatedAts, completedWaits, className }: {
  waitingCreatedAts: Date[];
  completedWaits: number[]; // minutes each completed patient waited
  className?: string;
}) {
  const compute = () => {
    const liveWaits = waitingCreatedAts.map(d => getElapsedMinutes(d));
    const all = [...liveWaits, ...completedWaits];
    if (all.length === 0) return 0;
    return all.reduce((s, v) => s + v, 0) / all.length;
  };

  // Keep a ref to the latest compute so the interval never uses a stale closure
  const computeRef = useRef(compute);
  computeRef.current = compute;

  const [avg, setAvg] = useState(compute);

  useEffect(() => {
    setAvg(computeRef.current());
    const interval = setInterval(() => setAvg(computeRef.current()), 10000);
    return () => clearInterval(interval);
  }, [waitingCreatedAts.length, completedWaits.length]);

  return <span className={className}>{formatWaitTime(avg)}</span>;
}
