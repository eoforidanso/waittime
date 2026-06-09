import { useState, useEffect } from 'react';
import type { Priority } from '../types';
import { BREACH_TARGETS } from '../types';

interface BreachCountdownProps {
  triagedAt: Date;
  priority: Priority;
  className?: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatCountdown(ms: number): string {
  const absSec = Math.abs(Math.floor(ms / 1000));
  const h = Math.floor(absSec / 3600);
  const m = Math.floor((absSec % 3600) / 60);
  const s = absSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Returns ms remaining until breach (negative if already breached) */
function getMsRemaining(triagedAt: Date, priority: Priority): number {
  const targetMs = BREACH_TARGETS[priority] * 60_000;
  const elapsed = Date.now() - new Date(triagedAt).getTime();
  return targetMs - elapsed;
}

export function BreachCountdown({ triagedAt, priority, className = '' }: BreachCountdownProps) {
  const [remaining, setRemaining] = useState(() => getMsRemaining(triagedAt, priority));

  useEffect(() => {
    // Immediately sync state when props change, then keep ticking
    setRemaining(getMsRemaining(triagedAt, priority));
    const id = setInterval(() => setRemaining(getMsRemaining(triagedAt, priority)), 1000);
    return () => clearInterval(id);
  }, [triagedAt, priority]);

  const breached = remaining <= 0;
  const critical = remaining <= 60_000 && remaining > 0; // < 1 min left

  if (priority === 'critical') {
    // Critical = immediate, always show "IMMEDIATE"
    return <span className={`breach-tag breach-immediate ${className}`}>IMMEDIATE</span>;
  }

  return (
    <span className={`breach-tag ${breached ? 'breach-over' : critical ? 'breach-warn' : 'breach-ok'} ${className}`}>
      {breached ? '⚠ BREACHED ' : ''}
      {breached ? '+' : ''}{formatCountdown(remaining)}
    </span>
  );
}

/** Summary for a list — returns counts by status */
export function getBreachSummary(tickets: Array<{ triagedAt: Date; priority: Priority; status: string }>) {
  let imminent = 0, breached = 0;
  for (const t of tickets) {
    if (t.status !== 'waiting' && t.status !== 'serving') continue;
    if (t.priority === 'critical') continue;
    const ms = getMsRemaining(new Date(t.triagedAt), t.priority);
    if (ms < 0) breached++;
    else if (ms < 5 * 60_000) imminent++;
  }
  return { imminent, breached };
}
