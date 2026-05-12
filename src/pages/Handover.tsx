import { useState } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { SERVICE_TYPES, SERVICE_COLORS } from '../types';
import type { ServiceType } from '../types';
import type { HandoverNote } from '../types';
import { ClipboardList, Pin, Trash2, Plus, X } from 'lucide-react';

const AREAS: (HandoverNote['area'])[] = ['General', 'Triage', ...SERVICE_TYPES];
const SHIFTS: HandoverNote['shift'][] = ['Day', 'Evening', 'Night'];

function getAreaColor(area: HandoverNote['area']): string {
  if (area === 'General') return '#6366f1';
  if (area === 'Triage') return '#a78bfa';
  return SERVICE_COLORS[area as ServiceType] ?? '#6b7280';
}

function getShiftTag(shift: HandoverNote['shift']): { label: string; cls: string } {
  if (shift === 'Day')     return { label: 'Day',     cls: 'shift-day' };
  if (shift === 'Evening') return { label: 'Evening', cls: 'shift-evening' };
  return                          { label: 'Night',   cls: 'shift-night' };
}

function timeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Handover() {
  const { state, addHandoverNote, removeHandoverNote, toggleHandoverPin } = useQueue();
  const toast = useToast();
  const { staffProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [area, setArea] = useState<HandoverNote['area']>('General');
  const [author, setAuthor] = useState('');
  const [shift, setShift] = useState<HandoverNote['shift']>('Day');
  const [content, setContent] = useState('');
  const [filterArea, setFilterArea] = useState<HandoverNote['area'] | 'All'>('All');
  const [filterShift, setFilterShift] = useState<HandoverNote['shift'] | 'All'>('All');

  // Pre-fill author from authenticated profile when form opens
  const openForm = () => {
    if (!showForm && staffProfile?.displayName) setAuthor(staffProfile.displayName);
    setShowForm(s => !s);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;
    addHandoverNote(area, author.trim(), content.trim(), shift);
    toast.success('Handover note added', `${area} — ${shift} shift`);
    setContent('');
    setAuthor('');
    setShowForm(false);
  };

  const notes = state.handoverNotes
    .filter(n => (filterArea === 'All' || n.area === filterArea) && (filterShift === 'All' || n.shift === filterShift))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="handover-page">
      <div className="page-header">
        <h1><ClipboardList size={26} /> Handover Board</h1>
        <p>Staff handover notes visible across all areas. Pin important items to keep them at the top.</p>
      </div>

      <div className="handover-toolbar">
        <button className="btn-add" onClick={openForm}>
          <Plus size={16} /> Add Note
        </button>
        <div className="handover-filters">
          <select className="ho-select" value={filterArea} onChange={e => setFilterArea(e.target.value as HandoverNote['area'] | 'All')}>
            <option value="All">All Areas</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="ho-select" value={filterShift} onChange={e => setFilterShift(e.target.value as HandoverNote['shift'] | 'All')}>
            <option value="All">All Shifts</option>
            {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="handover-count">{state.handoverNotes.length} note{state.handoverNotes.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <form className="handover-form" onSubmit={handleSubmit}>
          <div className="handover-form-row">
            <input
              className="ho-input"
              placeholder="Your name / role"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              required
            />
            <select className="ho-select" value={area} onChange={e => setArea(e.target.value as HandoverNote['area'])}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="ho-select" value={shift} onChange={e => setShift(e.target.value as HandoverNote['shift'])}>
              {SHIFTS.map(s => <option key={s} value={s}>{s} Shift</option>)}
            </select>
          </div>
          <textarea
            className="ho-textarea"
            placeholder="Handover note…"
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            required
          />
          <div className="handover-form-actions">
            <button type="submit" className="btn-submit-sm">Save Note</button>
            <button type="button" className="btn-add" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }} onClick={() => { setContent(''); setAuthor(''); setShowForm(false); }}>
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="handover-empty">No handover notes{filterArea !== 'All' || filterShift !== 'All' ? ' matching filters' : ''}. Add one to get started.</div>
      ) : (
        <div className="handover-notes-list">
          {notes.map(n => {
            const stag = getShiftTag(n.shift);
            return (
              <div key={n.id} className={`handover-note ${n.pinned ? 'pinned' : ''}`}>
                <div className="handover-note-header">
                  <span className="handover-area-tag" style={{ background: getAreaColor(n.area) }}>{n.area}</span>
                  <span className={`handover-shift-tag ${stag.cls}`}>{stag.label}</span>
                  <span className="handover-author">{n.author}</span>
                  <span className="handover-time">{timeAgo(n.createdAt)}</span>
                  <div className="handover-note-actions">
                    <button className={`ho-icon-btn${n.pinned ? ' pinned' : ''}`} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => toggleHandoverPin(n.id)}>
                      <Pin size={14} />
                    </button>
                    <button className="ho-icon-btn danger" title="Delete" onClick={() => removeHandoverNote(n.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="handover-note-content">{n.content}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
