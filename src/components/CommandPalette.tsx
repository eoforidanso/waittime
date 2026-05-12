import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueue } from '../context/QueueContext';
import {
  Search, LayoutDashboard, UserPlus, MonitorPlay, Tv, Settings,
  MapPin, FlaskConical, Pill, BedDouble, ClipboardList, Siren, CalendarDays,
  BarChart2, Calculator, User, Command,
} from 'lucide-react';

interface CmdItem {
  id: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'nav' | 'patient' | 'action';
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const location = useLocation();
  const { state } = useQueue();

  // Ctrl+K / Cmd+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setActiveIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const go = (path: string) => { nav(path); setOpen(false); };

  const items: CmdItem[] = useMemo(() => {
    const navItems: CmdItem[] = [
      { id: 'nav-dash', label: 'Dashboard', sub: 'Overview & census', icon: <LayoutDashboard size={16} />, action: () => go('/'), category: 'nav' },
      { id: 'nav-triage', label: 'Triage / Check-In', sub: 'Register new patients', icon: <UserPlus size={16} />, action: () => go('/checkin'), category: 'nav' },
      { id: 'nav-queue', label: 'ER Queue', sub: 'Manage bay patients', icon: <MonitorPlay size={16} />, action: () => go('/queue'), category: 'nav' },
      { id: 'nav-display', label: 'Display Board', sub: 'Public waiting room display', icon: <Tv size={16} />, action: () => go('/display'), category: 'nav' },
      { id: 'nav-bays', label: 'Bay Management', sub: 'Configure bays & staff', icon: <Settings size={16} />, action: () => go('/counters'), category: 'nav' },
      { id: 'nav-tracker', label: 'Ambulance Tracker', sub: 'Live ambulance locations', icon: <MapPin size={16} />, action: () => go('/tracker'), category: 'nav' },
      { id: 'nav-labs', label: 'Lab Reference', sub: 'Normal ranges & values', icon: <FlaskConical size={16} />, action: () => go('/labs'), category: 'nav' },
      { id: 'nav-drugs', label: 'Drug Reference', sub: 'Dosing & protocols', icon: <Pill size={16} />, action: () => go('/drugs'), category: 'nav' },
      { id: 'nav-beds', label: 'Bed Board', sub: 'Bed occupancy & status', icon: <BedDouble size={16} />, action: () => go('/beds'), category: 'nav' },
      { id: 'nav-handover', label: 'Handover Notes', sub: 'Shift handover & pins', icon: <ClipboardList size={16} />, action: () => go('/handover'), category: 'nav' },
      { id: 'nav-esc', label: 'Escalation Log', sub: 'Critical incidents', icon: <Siren size={16} />, action: () => go('/escalation'), category: 'nav' },
      { id: 'nav-shifts', label: 'Shift Schedule', sub: 'Monthly roster', icon: <CalendarDays size={16} />, action: () => go('/shifts'), category: 'nav' },
      { id: 'nav-analytics', label: 'Analytics', sub: 'Performance metrics', icon: <BarChart2 size={16} />, action: () => go('/analytics'), category: 'nav' },
      { id: 'nav-calcs', label: 'Medical Calculators', sub: 'GCS, HEART, CURB-65, Wells, NEWS2…', icon: <Calculator size={16} />, action: () => go('/calculators'), category: 'nav' },
    ];

    // Active patients as searchable items
    const activeTickets = state.tickets
      .filter(t => t.status === 'waiting' || t.status === 'serving')
      .slice(0, 30);

    const patientItems: CmdItem[] = activeTickets.map(t => ({
      id: `pt-${t.id}`,
      label: `${t.patientName} — ${t.ticketNumber}`,
      sub: `${t.service} · ${t.priority} · ${t.status}`,
      icon: <User size={16} />,
      action: () => go('/queue'),
      category: 'patient' as const,
    }));

    return [...navItems, ...patientItems];
  }, [state.tickets, location.pathname]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.sub?.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => { setActiveIdx(0); }, [filtered]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[activeIdx]) { filtered[activeIdx].action(); }
  };

  if (!open) return null;

  // Group by category
  const navResults = filtered.filter(i => i.category === 'nav');
  const patientResults = filtered.filter(i => i.category === 'patient');

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search pages, patients, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-esc">ESC</kbd>
        </div>
        <div className="cmd-results" ref={listRef}>
          {filtered.length === 0 && (
            <div className="cmd-empty">No results for "{query}"</div>
          )}
          {navResults.length > 0 && (
            <>
              <div className="cmd-group-label">Pages</div>
              {navResults.map(item => {
                const idx = filtered.indexOf(item);
                return (
                  <button
                    key={item.id}
                    className={`cmd-item ${idx === activeIdx ? 'cmd-active' : ''}`}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="cmd-item-icon">{item.icon}</span>
                    <span className="cmd-item-text">
                      <span className="cmd-item-label">{item.label}</span>
                      {item.sub && <span className="cmd-item-sub">{item.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          )}
          {patientResults.length > 0 && (
            <>
              <div className="cmd-group-label">Active Patients</div>
              {patientResults.map(item => {
                const idx = filtered.indexOf(item);
                return (
                  <button
                    key={item.id}
                    className={`cmd-item ${idx === activeIdx ? 'cmd-active' : ''}`}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="cmd-item-icon">{item.icon}</span>
                    <span className="cmd-item-text">
                      <span className="cmd-item-label">{item.label}</span>
                      {item.sub && <span className="cmd-item-sub">{item.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
