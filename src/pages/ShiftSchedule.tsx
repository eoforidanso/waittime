import { useState, useMemo, useEffect } from 'react';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { SERVICE_TYPES, SERVICE_COLORS, SHIFT_HOURS } from '../types';
import type { ServiceType, ShiftType } from '../types';
import { CalendarDays, Plus, Trash2, ChevronLeft, ChevronRight, Lock, Printer, X } from 'lucide-react';

const SHIFTS: ShiftType[] = ['Day', 'Evening', 'Night'];
const SHIFT_COLORS: Record<ShiftType, string> = { Day: '#f59e0b', Evening: '#8b5cf6', Night: '#3b82f6' };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(d: Date): string {
  // Use local date parts to avoid timezone shift
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns grid of Date|null for a full calendar month, Monday-first */
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  const firstDow = days[0].getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7;  // Monday-first offset
  const grid: (Date | null)[] = Array(offset).fill(null);
  grid.push(...days);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export default function ShiftSchedule() {
  const { state, addShift, removeShift } = useQueue();
  const { staffProfile } = useAuth();
  const todayDate = new Date();
  const today = isoDate(todayDate);

  const [viewYear, setViewYear]   = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());

  // Manager mode is now derived from Firebase auth role — no local override
  const MANAGER_ROLES_SET = new Set(['admin', 'doctor', 'nurse']);
  const managerMode = !!(staffProfile && MANAGER_ROLES_SET.has(staffProfile.role));
  const managerName = staffProfile?.displayName ?? '';

  // Add-shift form
  const [showForm, setShowForm]     = useState(false);
  const [formDate, setFormDate]     = useState(today);
  const [nurseId, setNurseId]       = useState('');
  const [shift, setShift]           = useState<ShiftType>('Day');
  const [area, setArea]             = useState<ServiceType | 'Triage'>('Triage');
  const [formNotes, setFormNotes]   = useState('');

  const calGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthShifts = state.shifts.filter(s => s.date.startsWith(monthPrefix));

  const shiftsByDate = useMemo(() => {
    const map: Record<string, typeof state.shifts> = {};
    for (const s of monthShifts) map[s.date] = [...(map[s.date] ?? []), s];
    return map;
  }, [monthShifts]);

  // Conflict detection
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const dayShifts of Object.values(shiftsByDate)) {
      const seen = new Map<string, string>();
      for (const s of dayShifts) {
        const key = `${s.nurseId}-${s.shift}`;
        if (seen.has(key)) { set.add(seen.get(key)!); set.add(s.id); }
        else seen.set(key, s.id);
      }
    }
    return set;
  }, [shiftsByDate]);

  const scheduleableNurses = state.nurses.filter(n => ['Staff Nurse', 'Charge Nurse'].includes(n.role));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Seed shifts for current month if none exist ───────────────────
  useEffect(() => {
    if (state.nurses.length === 0) return;
    // Only seed if no shifts exist — allows re-seed after a full clear
    if (state.shifts.length > 0) return;

    const chargeNurses = state.nurses.filter(n => n.role === 'Charge Nurse');
    const staffNurses  = state.nurses.filter(n => n.role === 'Staff Nurse' && n.onDuty);
    const nightNurses  = state.nurses.filter(n => n.role === 'Staff Nurse');

    if (chargeNurses.length === 0 || staffNurses.length === 0) return;

    const yr  = todayDate.getFullYear();
    const mon = todayDate.getMonth();
    const daysInMonth = new Date(yr, mon + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d  = new Date(yr, mon, day);
      const ds = isoDate(d);

      // Day shift: 2 charge nurses (rotating)
      const cn1 = chargeNurses[day % chargeNurses.length];
      const cn2 = chargeNurses[(day + Math.floor(chargeNurses.length / 2)) % chargeNurses.length];
      addShift(cn1.id, cn1.name, cn1.role, ds, 'Day', cn1.assignedArea);
      if (cn2.id !== cn1.id) addShift(cn2.id, cn2.name, cn2.role, ds, 'Day', cn2.assignedArea);

      // Evening shift: 2 staff nurses (rotating)
      const sn1 = staffNurses[day % staffNurses.length];
      const sn2 = staffNurses[(day + 2) % staffNurses.length];
      addShift(sn1.id, sn1.name, sn1.role, ds, 'Evening', sn1.assignedArea);
      if (sn2.id !== sn1.id) addShift(sn2.id, sn2.name, sn2.role, ds, 'Evening', sn2.assignedArea);

      // Night shift: 1–2 nurses (weekdays only for realism)
      const dow = d.getDay();
      if (dow !== 0) { // not Sunday
        const nn = nightNurses[(day + 4) % nightNurses.length];
        addShift(nn.id, nn.name, nn.role, ds, 'Night', nn.assignedArea);
      }
    }
  }, [state.nurses.length]); // run once nurses are loaded

  const openAddForm = (dateStr: string) => {
    if (!managerMode) return;
    setFormDate(dateStr);
    setNurseId('');
    setShift('Day');
    setArea('Triage');
    setFormNotes('');
    setShowForm(true);
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    const nurse = scheduleableNurses.find(n => n.id === nurseId);
    if (!nurse) return;
    addShift(nurse.id, nurse.name, nurse.role, formDate, shift, area, formNotes.trim() || undefined);
    setShowForm(false);
  };

  /* ── Print handler ───────────────────────────────────────── */
  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=1120,height=820');
    if (!w) { alert('Pop-up blocked — please allow pop-ups and try again.'); return; }

    const rows: string[] = [];
    for (let r = 0; r < calGrid.length / 7; r++) {
      const cells = calGrid.slice(r * 7, r * 7 + 7).map(day => {
        if (!day) return '<td class="empty-cell"></td>';
        const ds = isoDate(day);
        const dayShifts = shiftsByDate[ds] ?? [];
        const chips = dayShifts.map(s => {
          const conflict = conflicts.has(s.id) ? ' conflict' : '';
          return `<div class="pchip p${s.shift.toLowerCase()}${conflict}">${s.nurseName}<br/><span>${s.area}</span>${s.notes ? ' 📝' : ''}</div>`;
        }).join('');
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const isTd = ds === today;
        return `<td class="${isTd ? 'today-td' : ''}"><div class="day-num ${isWeekend ? 'wknd' : ''}">${day.getDate()}</div>${chips}</td>`;
      }).join('');
      rows.push(`<tr>${cells}</tr>`);
    }

    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Shift Roster – ${MONTH_NAMES[viewMonth]} ${viewYear}</title>
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.header h1{font-size:13pt;font-weight:900}
.header .sub{font-size:7.5pt;color:#555;margin-top:2px}
.legend{display:flex;gap:14px;align-items:center;margin-bottom:8px;font-size:7pt}
.leg{display:flex;align-items:center;gap:4px}
.ldot{width:10px;height:10px;border-radius:2px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{background:#1a1a2e;color:#fff;text-align:center;padding:4px 2px;font-size:8pt}
td{border:1px solid #ccc;vertical-align:top;padding:3px;height:75px}
td.empty-cell{background:#f7f7f7}
td.today-td{border:2px solid #3b82f6;background:#eff6ff}
.day-num{font-weight:700;font-size:8pt;margin-bottom:2px;padding-bottom:2px;border-bottom:1px solid #e5e7eb}
.day-num.wknd{color:#6366f1}
.pchip{padding:1px 4px;border-radius:3px;font-size:6.5pt;margin-bottom:2px;line-height:1.35}
.pchip span{opacity:0.7;font-size:6pt}
.pchip.conflict{outline:1px solid #dc2626}
.pday    {background:#fef3c7;color:#92400e}
.pevening{background:#ede9fe;color:#4c1d95}
.pnight  {background:#dbeafe;color:#1e3a8a}
.footer{display:flex;justify-content:space-between;margin-top:8px;font-size:7pt;color:#888}
.conflict-note{color:#dc2626;font-size:7pt;margin-top:4px}
</style></head><body>
<div class="header">
  <div>
    <h1>MediQ Emergency Department — Shift Roster</h1>
    <div class="sub">${MONTH_NAMES[viewMonth]} ${viewYear} &nbsp;|&nbsp; ${monthShifts.length} shift${monthShifts.length !== 1 ? 's' : ''} scheduled &nbsp;|&nbsp; Prepared by: ${managerName || 'Charge Nurse'}</div>
  </div>
  <div class="sub" style="text-align:right">Printed: ${new Date().toLocaleString('en-GB')}</div>
</div>
<div class="legend">
  <strong>Legend:</strong>
  <div class="leg"><div class="ldot" style="background:#f59e0b"></div> Day 07:00–15:00</div>
  <div class="leg"><div class="ldot" style="background:#8b5cf6"></div> Evening 15:00–23:00</div>
  <div class="leg"><div class="ldot" style="background:#3b82f6"></div> Night 23:00–07:00</div>
  ${conflicts.size > 0 ? `<div class="leg" style="color:#dc2626">⚠ ${conflicts.size / 2} conflict(s) — outlined in red</div>` : ''}
</div>
<table>
  <thead><tr>${DAY_LABELS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
<div class="footer">
  <span>MediQ ER — Confidential staff roster. Not for patient distribution.</span>
  <span>© 2026 MediQ</span>
</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="shift-page">
      <div className="page-header">
        <h1><CalendarDays size={26} /> Shift Schedule</h1>
        <p>Monthly nursing roster. Admin, Doctor, or Nurse access required to add or remove shifts.</p>
      </div>

      {/* Toolbar */}
      <div className="shift-toolbar">
        {/* Month navigation */}
        <div className="shift-month-nav">
          <button className="shift-nav-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <span className="shift-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className="shift-nav-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
          <button className="shift-nav-btn shift-today-btn" onClick={() => { setViewYear(todayDate.getFullYear()); setViewMonth(todayDate.getMonth()); }}>Today</button>
        </div>

        <div className="shift-toolbar-right">
          <span className="shift-month-count">{monthShifts.length} shift{monthShifts.length !== 1 ? 's' : ''} this month</span>

          {/* Manager indicator — derived from Firebase auth, no local unlock */}
          {managerMode ? (
            <div className="shift-manager-badge">
              <Lock size={14} /> {managerName}
            </div>
          ) : (
            <span className="shift-legend-hint" style={{ fontSize: '0.8rem' }}>
              <Lock size={13} /> View only — sign in as Admin / Doctor / Nurse to edit
            </span>
          )}

          {managerMode && (
            <button className="btn-add" onClick={() => openAddForm(today)}>
              <Plus size={15} /> Add Shift
            </button>
          )}

          <button className="shift-print-btn" onClick={handlePrint}>
            <Printer size={15} /> Print Roster
          </button>
        </div>
      </div>

      {/* ── Unlock modal removed — auth now via Firebase sign-in ── */}

      {/* Add shift form (slide-in) */}
      {showForm && managerMode && (
        <div className="shift-add-overlay" onClick={() => setShowForm(false)}>
          <form className="shift-add-modal" onClick={e => e.stopPropagation()} onSubmit={handleAddShift}>
            <div className="shift-form-header">
              <span>Add Shift — {new Date(formDate + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <button type="button" className="ho-icon-btn" onClick={() => setShowForm(false)}><X size={15} /></button>
            </div>
            <div className="shift-form-row">
              <select className="ho-select" value={nurseId} onChange={e => setNurseId(e.target.value)} required style={{ flex: 2 }}>
                <option value="">— Select staff member —</option>
                {scheduleableNurses.map(n => <option key={n.id} value={n.id}>{n.name} ({n.role})</option>)}
              </select>
              <select className="ho-select" value={shift} onChange={e => setShift(e.target.value as ShiftType)} style={{ flex:1 }}>
                {SHIFTS.map(s => <option key={s} value={s}>{s} — {SHIFT_HOURS[s]}</option>)}
              </select>
            </div>
            <div className="shift-form-row">
              <input type="date" className="ho-input" value={formDate} onChange={e => setFormDate(e.target.value)} required style={{ flex: 1 }} />
              <select className="ho-select" value={area} onChange={e => setArea(e.target.value as ServiceType | 'Triage')} style={{ flex: 1 }}>
                <option value="Triage">Triage</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input className="ho-input" style={{ width: '100%' }} placeholder="Notes (optional)" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            <div className="shift-form-row" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-submit-sm" disabled={!nurseId}>Add to Roster</button>
            </div>
          </form>
        </div>
      )}

      {/* Month calendar grid */}
      <div className="shift-cal-scroll-wrap">
      <div className="shift-cal-grid">
        {/* Day header row */}
        {DAY_LABELS.map(d => (
          <div key={d} className="shift-cal-day-hdr">{d}</div>
        ))}

        {/* Calendar cells */}
        {calGrid.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="shift-cal-cell shift-cal-empty" />;
          const ds = isoDate(day);
          const dayShifts = shiftsByDate[ds] ?? [];
          const isToday = ds === today;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isPast = ds < today;

          return (
            <div
              key={ds}
              className={`shift-cal-cell${isToday ? ' shift-cal-today' : ''}${isPast ? ' shift-cal-past' : ''}${managerMode ? ' shift-cal-clickable' : ''}`}
              onClick={() => openAddForm(ds)}
            >
              <div className={`shift-cal-num${isWeekend ? ' shift-cal-wknd' : ''}`}>
                {day.getDate()}
                {managerMode && <span className="shift-cal-add-hint">+</span>}
              </div>

              {SHIFTS.map(sType => {
                const sTypeShifts = dayShifts.filter(s => s.shift === sType);
                if (sTypeShifts.length === 0) return null;
                return (
                  <div key={sType} className="shift-cal-shift-group">
                    {sTypeShifts.map(s => (
                      <div
                        key={s.id}
                        className={`shift-cal-chip shift-cal-${sType.toLowerCase()}${conflicts.has(s.id) ? ' shift-cal-conflict' : ''}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="scc-name">{s.nurseName.split(' ')[0]}</span>
                        <span className="scc-area">{s.area === 'Triage' ? 'Tri' : s.area.split(' ').map(w => w[0]).join('')}</span>
                        {managerMode && (
                          <button
                            className="scc-remove"
                            title="Remove shift"
                            onClick={e => { e.stopPropagation(); removeShift(s.id); }}
                          >
                            <Trash2 size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>{/* end shift-cal-scroll-wrap */}

      {conflicts.size > 0 && (
        <div className="shift-conflict-warn">
          ⚠ {conflicts.size / 2} scheduling conflict{conflicts.size / 2 > 1 ? 's' : ''} detected this month — highlighted in red.
        </div>
      )}

      {/* Legend */}
      <div className="shift-legend">
        {SHIFTS.map(s => (
          <div key={s} className="shift-legend-item">
            <span className="shift-legend-dot" style={{ background: SHIFT_COLORS[s] }} />
            {s} <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{SHIFT_HOURS[s]}</span>
          </div>
        ))}
        {!managerMode && <span className="shift-legend-hint">Sign in as Admin / Doctor / Nurse to edit the roster</span>}
      </div>
    </div>
  );
}
