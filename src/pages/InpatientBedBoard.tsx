import { useState, useMemo } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { InpatientBedStatus, TicketStatus } from '../types';
import { INPATIENT_BED_STATUS_COLORS, INPATIENT_BED_STATUS_LABELS, TRIAGE_COLORS } from '../types';
import {
  Building2, BedDouble, UserPlus, LogOut, ArrowRightLeft,
  X, ChevronDown, Search, Wrench, Sparkles, CircleDot,
  Pencil, Trash2, Plus, ShieldAlert,
} from 'lucide-react';

const STATUS_CYCLE: InpatientBedStatus[] = ['occupied', 'cleaning', 'available', 'maintenance'];

type ModalMode =
  | { type: 'admit-direct'; unitId: string; bedId: string }
  | { type: 'admit-er'; unitId: string; bedId: string }
  | { type: 'transfer'; fromUnitId: string; fromBedId: string; patientName: string }
  | { type: 'add-unit' }
  | { type: 'edit-unit'; unitId: string }
  | null;

export default function InpatientBedBoard() {
  const { state, admitToInpatient, dischargeInpatient, transferInpatientBed, updateInpatientBedStatus,
    addInpatientUnit, editInpatientUnit, deleteInpatientUnit, addInpatientBeds } = useQueue();
  const toast = useToast();
  const { staffProfile } = useAuth();
  const isManager = staffProfile?.role === 'admin' || staffProfile?.role === 'doctor';

  const [search, setSearch] = useState('');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [transferTarget, setTransferTarget] = useState<{ unitId: string; bedId: string } | null>(null);

  // Direct admission form state
  const [admitForm, setAdmitForm] = useState({
    lastName: '', firstInitial: '', age: '', diagnosis: '', notes: '', erTicketId: '',
  });

  // Ward add/edit form state
  const PRESET_COLORS = ['#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#a855f7','#14b8a6','#f97316'];
  const [wardForm, setWardForm] = useState({
    name: '', abbreviation: '', color: PRESET_COLORS[0], bedCount: '10', addBeds: '', censusOverride: '',
  });

  const units = state.inpatientUnits;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let total = 0, occupied = 0, available = 0, cleaning = 0, maintenance = 0;
    for (const u of units) {
      for (const b of u.beds) {
        total++;
        if (b.status === 'occupied') occupied++;
        else if (b.status === 'available') available++;
        else if (b.status === 'cleaning') cleaning++;
        else if (b.status === 'maintenance') maintenance++;
      }
    }
    return { total, occupied, available, cleaning, maintenance };
  }, [units]);

  // ── ER patients eligible for inpatient admission ────────────────────────
  const erCandidates = useMemo(() =>
    state.tickets.filter(t =>
      (t.status === 'serving' || t.status === 'awaiting-bed' || t.status === 'results-pending') &&
      !(['admitted', 'discharged', 'completed', 'no-show', 'deceased'] as TicketStatus[]).includes(t.status)
    ),
    [state.tickets]
  );

  const formatName = (last: string, first: string) => {
    const l = last.trim();
    const f = first.trim().charAt(0).toUpperCase();
    if (!l) return '';
    return f ? `${l}, ${f}.` : l;
  };

  const handleAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal || (modal.type !== 'admit-direct' && modal.type !== 'admit-er')) return;

    if (modal.type === 'admit-direct') {
      const name = formatName(admitForm.lastName, admitForm.firstInitial);
      if (!name) return;
      admitToInpatient(
        modal.unitId, modal.bedId, name, 'Direct',
        admitForm.age ? parseInt(admitForm.age, 10) : undefined,
        undefined,
        admitForm.diagnosis.trim() || undefined,
        admitForm.notes.trim() || undefined,
      );
      const unitName = units.find(u => u.id === modal.unitId)?.name ?? 'Unit';
      toast.success(`Admitted to ${unitName}`, name);
    } else {
      // admit-er
      const ticket = state.tickets.find(t => t.id === admitForm.erTicketId);
      if (!ticket) return;
      admitToInpatient(
        modal.unitId, modal.bedId, ticket.patientName, 'ER',
        ticket.age,
        ticket.id,
        ticket.chiefComplaint,
        admitForm.notes.trim() || undefined,
      );
      const unitName = units.find(u => u.id === modal.unitId)?.name ?? 'Unit';
      toast.success(`Admitted from ER to ${unitName}`, ticket.patientName);
    }

    setModal(null);
    setAdmitForm({ lastName: '', firstInitial: '', age: '', diagnosis: '', notes: '', erTicketId: '' });
  };

  const handleDischarge = (unitId: string, bedId: string, patientName: string) => {
    dischargeInpatient(unitId, bedId);
    toast.info('Patient discharged', `${patientName} — bed set to cleaning`);
  };

  const handleTransferConfirm = () => {
    if (!modal || modal.type !== 'transfer' || !transferTarget) return;
    transferInpatientBed(modal.fromUnitId, modal.fromBedId, transferTarget.unitId, transferTarget.bedId);
    const targetUnit = units.find(u => u.id === transferTarget.unitId);
    const targetBed = targetUnit?.beds.find(b => b.id === transferTarget.bedId);
    toast.info('Patient transferred', `${modal.patientName} → ${targetUnit?.abbreviation ?? ''} ${targetBed?.bedNumber ?? ''}`);
    setModal(null);
    setTransferTarget(null);
  };

  const toggleBedStatus = (unitId: string, bedId: string, current: InpatientBedStatus) => {
    if (current === 'occupied') return; // use discharge instead
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    updateInpatientBedStatus(unitId, bedId, next === 'occupied' ? 'available' : next);
  };

  const openAddWard = () => {
    setWardForm({ name: '', abbreviation: '', color: PRESET_COLORS[0], bedCount: '10', addBeds: '', censusOverride: '' });
    setModal({ type: 'add-unit' });
  };

  const openEditWard = (unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const u = units.find(u => u.id === unitId);
    if (!u) return;
    const occupied = u.beds.filter(b => b.status === 'occupied').length;
    setWardForm({ name: u.name, abbreviation: u.abbreviation, color: u.color, bedCount: String(u.beds.length), addBeds: '', censusOverride: String(occupied) });
    setModal({ type: 'edit-unit', unitId });
  };

  const handleDeleteWard = (unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const u = units.find(u => u.id === unitId);
    if (!u) return;
    const occupied = u.beds.filter(b => b.status === 'occupied').length;
    if (occupied > 0) {
      toast.error('Cannot delete ward', `${u.name} has ${occupied} occupied bed${occupied > 1 ? 's' : ''}. Discharge all patients first.`);
      return;
    }
    deleteInpatientUnit(unitId);
    toast.info('Ward removed', u.name);
  };

  const handleSaveWard = (e: React.FormEvent) => {
    e.preventDefault();
    const name = wardForm.name.trim();
    const abbreviation = wardForm.abbreviation.trim().toUpperCase();
    if (!name || !abbreviation) return;

    if (modal?.type === 'add-unit') {
      const count = Math.max(1, Math.min(200, parseInt(wardForm.bedCount, 10) || 1));
      addInpatientUnit(name, abbreviation, wardForm.color, count);
      toast.success('Ward added', `${name} (${count} beds)`);
    } else if (modal?.type === 'edit-unit') {
      editInpatientUnit(modal.unitId, name, abbreviation, wardForm.color);
      const extra = parseInt(wardForm.addBeds, 10);
      if (extra > 0) addInpatientBeds(modal.unitId, extra);
      // Census override: correct occupied count by freeing overcounted beds only
      // (we cannot *increase* occupied count — beds need real patient data)
      const censusTarget = parseInt(wardForm.censusOverride ?? '', 10);
      if (!isNaN(censusTarget) && censusTarget >= 0) {
        const unit = units.find(u => u.id === modal.unitId);
        if (unit) {
          const occupied = unit.beds.filter(b => b.status === 'occupied');
          if (censusTarget < occupied.length) {
            // Free from the end (most recently occupied beds first)
            const toFree = occupied.length - censusTarget;
            occupied.slice(-toFree).forEach(b => updateInpatientBedStatus(unit.id, b.id, 'cleaning'));
          }
          // Note: increasing census via override is not supported — use "Admit" to add real patients
        }
      }
      toast.success('Ward updated', name);
    }
    setModal(null);
  };

  const handleForceClearBed = (unitId: string, bedId: string, patientName: string) => {
    if (!window.confirm(`Override census: mark ${patientName}'s bed as available without formal discharge?`)) return;
    updateInpatientBedStatus(unitId, bedId, 'available');
    toast.info('Census corrected', `Bed cleared — ${patientName}`);
  };

  const filteredUnits = useMemo(() => {
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.map(u => ({
      ...u,
      beds: u.beds.filter(b =>
        b.bedNumber.toLowerCase().includes(q) ||
        b.patient?.name.toLowerCase().includes(q) ||
        b.patient?.diagnosis?.toLowerCase().includes(q) ||
        b.status.includes(q)
      ),
    })).filter(u => u.beds.length > 0 || u.name.toLowerCase().includes(q));
  }, [units, search]);

  return (
    <div className="inpatient-page">
      <div className="page-header">
        <div>
          <h1><Building2 size={28} /> Inpatient Bed Management</h1>
          <p>Hospital-wide ward and bed status — admit, transfer, and discharge patients</p>
        </div>
        {isManager && (
          <button className="btn-primary ipt-add-ward-btn" onClick={openAddWard}>
            <Plus size={16} /> Add Ward
          </button>
        )}
      </div>

      {/* ── Summary stats ── */}
      <div className="inpatient-stats-row">
        <div className="ipt-stat" style={{ borderColor: INPATIENT_BED_STATUS_COLORS.occupied }}>
          <span className="ipt-stat-num" style={{ color: INPATIENT_BED_STATUS_COLORS.occupied }}>{stats.occupied}</span>
          <span className="ipt-stat-label">Occupied</span>
        </div>
        <div className="ipt-stat" style={{ borderColor: INPATIENT_BED_STATUS_COLORS.available }}>
          <span className="ipt-stat-num" style={{ color: INPATIENT_BED_STATUS_COLORS.available }}>{stats.available}</span>
          <span className="ipt-stat-label">Available</span>
        </div>
        <div className="ipt-stat" style={{ borderColor: INPATIENT_BED_STATUS_COLORS.cleaning }}>
          <span className="ipt-stat-num" style={{ color: INPATIENT_BED_STATUS_COLORS.cleaning }}>{stats.cleaning}</span>
          <span className="ipt-stat-label">Cleaning</span>
        </div>
        <div className="ipt-stat" style={{ borderColor: INPATIENT_BED_STATUS_COLORS.maintenance }}>
          <span className="ipt-stat-num" style={{ color: INPATIENT_BED_STATUS_COLORS.maintenance }}>{stats.maintenance}</span>
          <span className="ipt-stat-label">Maintenance</span>
        </div>
        <div className="ipt-stat" style={{ borderColor: '#a5b4fc' }}>
          <span className="ipt-stat-num" style={{ color: '#a5b4fc' }}>{stats.total}</span>
          <span className="ipt-stat-label">Total Beds</span>
        </div>
        <div className="ipt-stat" style={{ borderColor: stats.occupied / stats.total > 0.9 ? '#ef4444' : '#94a3b8' }}>
          <span className="ipt-stat-num" style={{ color: stats.occupied / stats.total > 0.9 ? '#ef4444' : '#94a3b8' }}>
            {stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0}%
          </span>
          <span className="ipt-stat-label">Occupancy</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="ipt-search-bar">
        <Search size={16} />
        <input
          placeholder="Search patient, bed, diagnosis, unit…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ipt-search-input"
        />
        {search && <button className="ipt-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
      </div>

      {/* ── Unit cards ── */}
      <div className="ipt-units-list">
        {filteredUnits.map(unit => {
          const occCount = unit.beds.filter(b => b.status === 'occupied').length;
          const availCount = unit.beds.filter(b => b.status === 'available').length;
          const pct = unit.beds.length > 0 ? Math.round((occCount / unit.beds.length) * 100) : 0;
          const isExpanded = expandedUnit === unit.id;

          return (
            <div key={unit.id} className="ipt-unit-card">
              {/* Unit header */}
              <div
                className="ipt-unit-header"
                style={{ borderLeftColor: unit.color }}
                onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
              >
                <div className="ipt-unit-title">
                  <span className="ipt-unit-abbr" style={{ background: unit.color + '22', color: unit.color }}>{unit.abbreviation}</span>
                  <span className="ipt-unit-name">{unit.name}</span>
                </div>
                <div className="ipt-unit-meta">
                  <span className="ipt-unit-count">{occCount}/{unit.beds.length} beds</span>
                  <div className="ipt-unit-bar-wrap">
                    <div className="ipt-unit-bar">
                      <div className="ipt-unit-bar-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : unit.color }} />
                    </div>
                    <span className={`ipt-unit-pct${pct > 90 ? ' pct-crit' : pct > 70 ? ' pct-warn' : ''}`}>{pct}%</span>
                  </div>
                  <span className="ipt-avail-pill">{availCount} free</span>
                  {isManager && (
                    <>
                      <button className="ipt-unit-action-btn" title="Edit ward" onClick={e => openEditWard(unit.id, e)}><Pencil size={13} /></button>
                      <button className="ipt-unit-action-btn ipt-unit-delete-btn" title="Delete ward" onClick={e => handleDeleteWard(unit.id, e)}><Trash2 size={13} /></button>
                    </>
                  )}
                  <ChevronDown size={16} className={`ipt-chevron ${isExpanded ? 'open' : ''}`} />
                </div>
              </div>

              {/* Expanded bed grid */}
              {isExpanded && (
                <div className="ipt-beds-grid">
                  {unit.beds.map(bed => {
                    const color = INPATIENT_BED_STATUS_COLORS[bed.status];
                    return (
                      <div
                        key={bed.id}
                        className={`ipt-bed-card ipt-bed-${bed.status}`}
                        style={{ borderColor: color }}
                      >
                        <div className="ipt-bed-header">
                          <span className="ipt-bed-num" style={{ color }}>{bed.bedNumber}</span>
                          <span className="ipt-bed-status-tag" style={{ background: color + '22', color }}>
                            {INPATIENT_BED_STATUS_LABELS[bed.status]}
                          </span>
                        </div>

                        {bed.patient ? (
                          <div className="ipt-bed-patient">
                            <div className="ipt-bed-patient-name">{bed.patient.name}</div>
                            {bed.patient.age && <div className="ipt-bed-patient-meta">{bed.patient.age} yrs</div>}
                            {bed.patient.diagnosis && <div className="ipt-bed-diagnosis">{bed.patient.diagnosis}</div>}
                            <div className="ipt-bed-admitted">
                              <span className={`ipt-from-badge ${bed.patient.admittedFrom === 'ER' ? 'from-er' : 'from-direct'}`}>
                                {bed.patient.admittedFrom === 'ER' ? '🚑 ER' : '➡ Direct'}
                              </span>
                              <span className="ipt-admitted-time">
                                {bed.patient.admittedAt.toLocaleDateString()} {bed.patient.admittedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="ipt-bed-actions">
                              <button
                                className="ipt-btn ipt-btn-discharge"
                                onClick={() => handleDischarge(unit.id, bed.id, bed.patient!.name)}
                                title="Discharge patient"
                              >
                                <LogOut size={12} /> Discharge
                              </button>
                              <button
                                className="ipt-btn ipt-btn-transfer"
                                onClick={() => setModal({ type: 'transfer', fromUnitId: unit.id, fromBedId: bed.id, patientName: bed.patient!.name })}
                                title="Transfer to another bed"
                              >
                                <ArrowRightLeft size={12} /> Transfer
                              </button>
                              {isManager && (
                                <button
                                  className="ipt-btn ipt-btn-override"
                                  onClick={() => handleForceClearBed(unit.id, bed.id, bed.patient!.name)}
                                  title="Census override: clear bed without formal discharge"
                                >
                                  <ShieldAlert size={12} /> Override
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="ipt-bed-empty">
                            {bed.status === 'available' && (
                              <div className="ipt-bed-admit-btns">
                                <button
                                  className="ipt-btn ipt-btn-admit"
                                  onClick={() => { setModal({ type: 'admit-er', unitId: unit.id, bedId: bed.id }); setAdmitForm(f => ({ ...f, erTicketId: '' })); }}
                                >
                                  <UserPlus size={12} /> From ER
                                </button>
                                <button
                                  className="ipt-btn ipt-btn-admit-direct"
                                  onClick={() => { setModal({ type: 'admit-direct', unitId: unit.id, bedId: bed.id }); setAdmitForm({ lastName: '', firstInitial: '', age: '', diagnosis: '', notes: '', erTicketId: '' }); }}
                                >
                                  <UserPlus size={12} /> Direct
                                </button>
                              </div>
                            )}
                            {bed.status !== 'available' && (
                              <button
                                className="ipt-btn ipt-btn-status"
                                onClick={() => toggleBedStatus(unit.id, bed.id, bed.status)}
                                title="Cycle bed status"
                              >
                                {bed.status === 'cleaning' && <><Sparkles size={12} /> Mark Available</>}
                                {bed.status === 'maintenance' && <><Wrench size={12} /> Mark Available</>}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="ipt-legend">
        {(Object.entries(INPATIENT_BED_STATUS_COLORS) as [InpatientBedStatus, string][]).map(([status, color]) => (
          <span key={status} className="ipt-legend-item">
            <CircleDot size={12} style={{ color }} />
            {INPATIENT_BED_STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {/* ── Admit from ER modal ── */}
      {modal?.type === 'admit-er' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal ipt-modal" onClick={e => e.stopPropagation()}>
            <div className="ipt-modal-header">
              <h3><UserPlus size={20} /> Admit from ER</h3>
              <button className="ipt-modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <p className="ipt-modal-sub">Select an ER patient to admit to this bed.</p>
            <form onSubmit={handleAdmit} className="ipt-modal-form">
              <label>ER Patient</label>
              <select
                value={admitForm.erTicketId}
                onChange={e => setAdmitForm(f => ({ ...f, erTicketId: e.target.value }))}
                required
                className="ipt-select"
              >
                <option value="">— Select patient —</option>
                {erCandidates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.ticketNumber} · {t.patientName}{t.age ? ` (${t.age}y)` : ''} — {t.service} · {t.status.replace('-', ' ')}
                  </option>
                ))}
              </select>
              {admitForm.erTicketId && (() => {
                const t = erCandidates.find(t => t.id === admitForm.erTicketId);
                return t ? (
                  <div className="ipt-er-preview">
                    <span className={`priority-tag ${t.priority}`}>{t.priority}</span>
                    <span style={{ color: TRIAGE_COLORS[t.priority] }}>{t.service}</span>
                    {t.chiefComplaint && <span className="ipt-cc">{t.chiefComplaint}</span>}
                  </div>
                ) : null;
              })()}
              <label>Admission notes (optional)</label>
              <textarea
                value={admitForm.notes}
                onChange={e => setAdmitForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Transfer notes, pending results…"
                className="ipt-textarea"
              />
              <div className="ipt-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!admitForm.erTicketId}>Admit Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Direct admission modal ── */}
      {modal?.type === 'admit-direct' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal ipt-modal" onClick={e => e.stopPropagation()}>
            <div className="ipt-modal-header">
              <h3><UserPlus size={20} /> Direct Admission</h3>
              <button className="ipt-modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdmit} className="ipt-modal-form">
              <div className="ipt-form-row">
                <div>
                  <label>Last Name</label>
                  <input
                    value={admitForm.lastName}
                    onChange={e => setAdmitForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Smith"
                    required
                    className="ipt-input"
                  />
                </div>
                <div>
                  <label>First Initial</label>
                  <input
                    value={admitForm.firstInitial}
                    onChange={e => setAdmitForm(f => ({ ...f, firstInitial: e.target.value.slice(0, 1) }))}
                    placeholder="J"
                    required
                    maxLength={1}
                    className="ipt-input ipt-input-sm"
                  />
                </div>
                <div>
                  <label>Age</label>
                  <input
                    type="number"
                    value={admitForm.age}
                    onChange={e => setAdmitForm(f => ({ ...f, age: e.target.value }))}
                    min={0} max={130}
                    placeholder="—"
                    className="ipt-input ipt-input-sm"
                  />
                </div>
              </div>
              <label>Diagnosis / Reason for admission</label>
              <input
                value={admitForm.diagnosis}
                onChange={e => setAdmitForm(f => ({ ...f, diagnosis: e.target.value }))}
                placeholder="e.g. Community-acquired pneumonia"
                className="ipt-input"
              />
              <label>Notes (optional)</label>
              <textarea
                value={admitForm.notes}
                onChange={e => setAdmitForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Allergy notes, isolation requirements…"
                className="ipt-textarea"
              />
              <div className="ipt-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Admit Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Transfer modal ── */}
      {modal?.type === 'transfer' && (
        <div className="modal-overlay" onClick={() => { setModal(null); setTransferTarget(null); }}>
          <div className="modal ipt-modal ipt-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="ipt-modal-header">
              <h3><ArrowRightLeft size={20} /> Transfer Patient</h3>
              <button className="ipt-modal-close" onClick={() => { setModal(null); setTransferTarget(null); }}><X size={18} /></button>
            </div>
            <p className="ipt-modal-sub">
              Moving <strong>{modal.patientName}</strong>. Select a destination bed.
            </p>
            <div className="ipt-transfer-units">
              {units.map(u => {
                const availBeds = u.beds.filter(b => b.status === 'available');
                if (availBeds.length === 0) return null;
                return (
                  <div key={u.id} className="ipt-transfer-unit">
                    <div className="ipt-transfer-unit-name" style={{ color: u.color }}>{u.abbreviation} — {u.name}</div>
                    <div className="ipt-transfer-beds">
                      {availBeds.map(b => (
                        <button
                          key={b.id}
                          className={`ipt-transfer-bed-btn${transferTarget?.bedId === b.id ? ' selected' : ''}`}
                          style={{ borderColor: transferTarget?.bedId === b.id ? u.color : undefined }}
                          onClick={() => setTransferTarget({ unitId: u.id, bedId: b.id })}
                        >
                          {b.bedNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ipt-modal-footer">
              <button type="button" className="btn-cancel" onClick={() => { setModal(null); setTransferTarget(null); }}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!transferTarget}
                onClick={handleTransferConfirm}
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Add / Edit ward modal ── */}
      {(modal?.type === 'add-unit' || modal?.type === 'edit-unit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal ipt-modal" onClick={e => e.stopPropagation()}>
            <div className="ipt-modal-header">
              <h3>{modal.type === 'add-unit' ? <><Plus size={18} /> New Ward</> : <><Pencil size={18} /> Edit Ward</>}</h3>
              <button className="ipt-modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveWard} className="ipt-modal-form">
              <div>
                <label>Ward Name</label>
                <input
                  value={wardForm.name}
                  onChange={e => setWardForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Intensive Care Unit"
                  required
                  className="ipt-input"
                />
              </div>
              <div className="ipt-form-row">
                <div>
                  <label>Abbreviation</label>
                  <input
                    value={wardForm.abbreviation}
                    onChange={e => setWardForm(f => ({ ...f, abbreviation: e.target.value.toUpperCase().slice(0, 6) }))}
                    placeholder="e.g. ICU"
                    required
                    maxLength={6}
                    className="ipt-input"
                  />
                </div>
                {modal.type === 'add-unit' && (
                  <div>
                    <label>Initial Beds</label>
                    <input
                      type="number"
                      value={wardForm.bedCount}
                      onChange={e => setWardForm(f => ({ ...f, bedCount: e.target.value }))}
                      min={1} max={200}
                      required
                      className="ipt-input"
                    />
                  </div>
                )}
              </div>
              {modal.type === 'edit-unit' && (() => {
                const u = units.find(u => u.id === modal.unitId);
                const occupied = u?.beds.filter(b => b.status === 'occupied').length ?? 0;
                return u ? (
                  <>
                    <div>
                      <label>Add More Beds (current: {u.beds.length})</label>
                      <input
                        type="number"
                        value={wardForm.addBeds}
                        onChange={e => setWardForm(f => ({ ...f, addBeds: e.target.value }))}
                        min={0} max={200}
                        placeholder="0 — leave blank to keep current"
                        className="ipt-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldAlert size={13} style={{ color: '#f59e0b' }} />
                        Census Override — Correct Occupied Count (currently {occupied}/{u.beds.length})
                      </label>
                      <input
                        type="number"
                        value={wardForm.censusOverride}
                        onChange={e => setWardForm(f => ({ ...f, censusOverride: e.target.value }))}
                        min={0} max={occupied}
                        placeholder={`${occupied} — reduce to correct overcounting`}
                        className="ipt-input"
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Only reduces count. To add patients, use the Admit button on an available bed.
                      </small>
                    </div>
                  </>
                ) : null;
              })()}
              <div>
                <label>Colour</label>
                <div className="ipt-color-row">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`ipt-color-swatch${wardForm.color === c ? ' selected' : ''}`}
                      style={{ background: c, boxShadow: wardForm.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}
                      onClick={() => setWardForm(f => ({ ...f, color: c }))}
                      aria-label={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={wardForm.color}
                    onChange={e => setWardForm(f => ({ ...f, color: e.target.value }))}
                    className="ipt-color-custom"
                    title="Custom colour"
                  />
                </div>
              </div>
              {/* Preview */}
              <div className="ipt-ward-preview">
                <span className="ipt-unit-abbr" style={{ background: wardForm.color + '22', color: wardForm.color }}>
                  {wardForm.abbreviation || 'ABC'}
                </span>
                <span className="ipt-unit-name">{wardForm.name || 'Ward Name'}</span>
              </div>
              <div className="ipt-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {modal.type === 'add-unit' ? 'Create Ward' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
