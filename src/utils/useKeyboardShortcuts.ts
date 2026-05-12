import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../context/QueueContext';

/**
 * Global keyboard shortcuts for MediQ staff interface.
 *
 * Shortcuts (only when no input/textarea/select is focused):
 *   N  → Navigate to /queue (ER Queue / call-next page)
 *   T  → Navigate to /checkin (Triage check-in)
 *   D  → Navigate to / (Dashboard)
 *   B  → Navigate to /beds (Bed Board)
 *   H  → Navigate to /handover (Handover notes)
 *   E  → Navigate to /escalation (Escalation Log)
 *   R  → Navigate to /records (Patient Records)
 *   ?  → Show/hide keyboard shortcut help panel
 */
export default function useKeyboardShortcuts(
  onShowHelp: (show: boolean) => void,
) {
  const nav = useNavigate();
  const { callNext, state } = useQueue();

  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.key.toLowerCase()) {
      case 'n':
        nav('/queue');
        break;
      case 't':
        nav('/checkin');
        break;
      case 'd':
        nav('/');
        break;
      case 'b':
        nav('/beds');
        break;
      case 'h':
        nav('/handover');
        break;
      case 'e':
        nav('/escalation');
        break;
      case 'r':
        nav('/records');
        break;
      case '?':
        onShowHelp(true);
        break;
      case 'escape':
        onShowHelp(false);
        break;
      default:
        break;
    }
  }, [nav, callNext, state, onShowHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
