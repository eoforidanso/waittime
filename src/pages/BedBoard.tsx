import { useState, useEffect, useRef } from 'react';
import { useQueue } from '../context/QueueContext';
import { SERVICE_COLORS, SERVICE_TYPES } from '../types';
import type { ServiceType } from '../types';
import { Bed, Minus, Plus, User } from 'lucide-react';

const BED_STATUS_COLORS = {
  occupied: '#ef4444',
  available: '#10b981',
  cleaning: '#f59e0b',
} as const;

type BedStatus = 'occupied' | 'available' | 'cleaning';

export default function BedBoard() {
  const { state, updateBeds } = useQueue();
  // Local per-bay bed statuses (fine-grained, not persisted)
  const [bedStatuses, setBedStatuses] = useState<Record<number, BedStatus[]>>(() => {
    const init: Record<number, BedStatus[]> = {};
    for (const c of state.counters) {
      init[c.id] = Array.from({ length: c.beds }, (_, i) =>
        i < c.bedsOccupied ? 'occupied' : 'available'
      );
    }
    return init;
  });

  // Track whether a local toggle is in flight so we don't clobber it with a context sync
  const localUpdateRef = useRef(false);

  // Sync local bed grid when context bedsOccupied changes externally (e.g. patient admitted from CheckIn)
  useEffect(() => {
    if (localUpdateRef.current) { localUpdateRef.current = false; return; }
    setBedStatuses(prev => {
      const next = { ...prev };
      for (const c of state.counters) {
        const current = prev[c.id];
        if (!current) {
          next[c.id] = Array.from({ length: c.beds }, (_, i) =>
            i < c.bedsOccupied ? 'occupied' : 'available'
          );
          continue;
        }
        const prevOccupied = current.filter(s => s === 'occupied').length;
        if (prevOccupied === c.bedsOccupied) continue; // no change
        // Reconcile: adjust occupied slots to match context count
        const updated = [...current];
        if (c.bedsOccupied > prevOccupied) {
          let toMark = c.bedsOccupied - prevOccupied;
          // First pass: mark 'available' beds
          for (let i = 0; i < updated.length && toMark > 0; i++) {
            if (updated[i] === 'available') { updated[i] = 'occupied'; toMark--; }
          }
          // Second pass: mark 'cleaning' beds if still short (all remaining were cleaning)
          for (let i = 0; i < updated.length && toMark > 0; i++) {
            if (updated[i] === 'cleaning') { updated[i] = 'occupied'; toMark--; }
          }
        } else {
          let toFree = prevOccupied - c.bedsOccupied;
          for (let i = updated.length - 1; i >= 0 && toFree > 0; i--) {
            if (updated[i] === 'occupied') { updated[i] = 'available'; toFree--; }
          }
        }
        next[c.id] = updated;
      }
      return next;
    });
  }, [state.counters.map(c => `${c.id}:${c.bedsOccupied}`).join(',')]);

  // Sync bed count with context when user toggles a bed
  const toggleBed = (bayId: number, bedIndex: number) => {
    localUpdateRef.current = true;
    setBedStatuses(prev => {
      const current = [...(prev[bayId] ?? [])];
      const cycle: BedStatus[] = ['occupied', 'cleaning', 'available'];
      const next = cycle[(cycle.indexOf(current[bedIndex]) + 1) % cycle.length];
      current[bedIndex] = next;
      // Update context occupied count
      const occupied = current.filter(s => s === 'occupied').length;
      updateBeds(bayId, occupied);
      return { ...prev, [bayId]: current };
    });
  };

  const totalBeds = state.counters.reduce((s, c) => s + c.beds, 0);
  const totalOccupied = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
  const totalCleaning = Object.values(bedStatuses).reduce((s, arr) => s + arr.filter(b => b === 'cleaning').length, 0);
  const totalAvailable = totalBeds - totalOccupied - totalCleaning;

  const byService: Record<string, typeof state.counters> = {};
  for (const c of state.counters) {
    if (!byService[c.service]) byService[c.service] = [];
    byService[c.service].push(c);
  }

  return (
    <div className="bed-board-page">
      <div className="page-header">
        <h1><Bed size={26} /> Bed Occupancy Board</h1>
        <p>Click a bed to cycle: Occupied → Cleaning → Available. Live count synced to Bay Management.</p>
      </div>

      <div className="bed-board-summary">
        <div className="bed-stat-box">
          <span className="bed-stat-num" style={{ color: '#ef4444' }}>{totalOccupied}</span>
          <span className="bed-stat-label">Occupied</span>
        </div>
        <div className="bed-stat-box">
          <span className="bed-stat-num" style={{ color: '#f59e0b' }}>
            {totalCleaning}
          </span>
          <span className="bed-stat-label">Cleaning</span>
        </div>
        <div className="bed-stat-box">
          <span className="bed-stat-num" style={{ color: '#10b981' }}>{totalAvailable}</span>
          <span className="bed-stat-label">Available</span>
        </div>
        <div className="bed-stat-box">
          <span className="bed-stat-num" style={{ color: '#a5b4fc' }}>{totalBeds}</span>
          <span className="bed-stat-label">Total Beds</span>
        </div>
        <div className="bed-stat-box">
          <span className="bed-stat-num" style={{ color: totalOccupied / totalBeds > 0.9 ? '#ef4444' : '#94a3b8' }}>
            {totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0}%
          </span>
          <span className="bed-stat-label">Occupancy</span>
        </div>
      </div>

      <div className="bed-board-grid">
        {SERVICE_TYPES.map(service => {
          const bays = byService[service];
          if (!bays || bays.length === 0) return null;
          return (
            <div key={service} className="bed-service-section">
              <div className="bed-service-header" style={{ borderLeftColor: SERVICE_COLORS[service as ServiceType] }}>
                <span className="bed-service-name" style={{ color: SERVICE_COLORS[service as ServiceType] }}>{service}</span>
              </div>
              <div className="bed-bays-row">
                {bays.map(bay => {
                  const statuses = bedStatuses[bay.id] ?? [];
                  // Grow or shrink statuses if beds changed
                  const normalised: BedStatus[] = Array.from({ length: bay.beds }, (_, i) =>
                    statuses[i] ?? (i < bay.bedsOccupied ? 'occupied' : 'available')
                  );
                  const occCount = normalised.filter(s => s === 'occupied').length;
                  const cleanCount = normalised.filter(s => s === 'cleaning').length;
                  const pct = bay.beds > 0 ? Math.round((occCount / bay.beds) * 100) : 0;
                  return (
                    <div key={bay.id} className={`bed-bay-card ${bay.isActive ? '' : 'bed-bay-inactive'}`}>
                      <div className="bed-bay-header">
                        <span className="bed-bay-name">{bay.name}</span>
                        <span className={`bed-bay-pct${pct >= 90 ? ' bed-pct-critical' : pct >= 70 ? ' bed-pct-warn' : ''}`}>{pct}%</span>
                      </div>
                      {bay.currentTicket && (
                        <div className="bed-bay-patient">
                          <User size={11} />
                          <span className="bed-bay-patient-name">{bay.currentTicket.patientName}</span>
                        </div>
                      )}
                      <div className="bed-grid">
                        {normalised.map((status, idx) => (
                          <button
                            key={idx}
                            className={`bed-cell bed-${status}`}
                            title={`Bed ${idx + 1}: ${status} — click to change`}
                            onClick={() => toggleBed(bay.id, idx)}
                            disabled={!bay.isActive}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                      <div className="bed-bay-counts">
                        <span style={{ color: '#ef4444' }}>{occCount} occ</span>
                        {cleanCount > 0 && <span style={{ color: '#f59e0b' }}>{cleanCount} clean</span>}
                        <span style={{ color: '#10b981' }}>{bay.beds - occCount - cleanCount} avail</span>
                      </div>
                      <div className="bed-bay-adjust">
                        <button className="bed-adj-btn" onClick={() => updateBeds(bay.id, Math.max(0, bay.bedsOccupied - 1))}><Minus size={11} /></button>
                        <span className="bed-adj-label">Occupied: {occCount}</span>
                        <button className="bed-adj-btn" onClick={() => updateBeds(bay.id, Math.min(bay.beds, bay.bedsOccupied + 1))}><Plus size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bed-legend">
        {Object.entries(BED_STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="bed-legend-item">
            <span className="bed-legend-dot" style={{ background: color }} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
