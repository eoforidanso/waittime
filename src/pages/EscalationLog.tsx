import { useState, type ReactNode } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { SERVICE_TYPES, SERVICE_COLORS } from '../types';
import type { ServiceType, EscalationSeverity } from '../types';
import type { EscalationEntry } from '../types';
import { Siren, CheckCircle, Trash2, Plus, X, AlertTriangle, Info } from 'lucide-react';

const AREAS: EscalationEntry['area'][] = ['All Areas', 'Triage', ...SERVICE_TYPES];

const SEVERITY_CONFIG: Record<EscalationSeverity, { label: string; color: string; icon: ReactNode }> = {
  info:     { label: 'Info',     color: '#3b82f6', icon: <Info     size={15} /> },
  warning:  { label: 'Warning',  color: '#f59e0b', icon: <AlertTriangle size={15} /> },
  critical: { label: 'Critical', color: '#ef4444', icon: <Siren    size={15} /> },
};

function timeStr(d: Date): string {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getAreaColor(area: string): string {
  if (area === 'All Areas') return '#6366f1';
  if (area === 'Triage') return '#a78bfa';
  if (SERVICE_TYPES.includes(area as ServiceType)) return SERVICE_COLORS[area as ServiceType];
  return '#6b7280';
}

export default function EscalationLog() {
  const { state, addEscalation, resolveEscalation, removeEscalation } = useQueue();
  const toast = useToast();
  const { staffProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [severity, setSeverity] = useState<EscalationSeverity>('warning');
  const [author, setAuthor] = useState('');
  const [area, setArea] = useState<EscalationEntry['area']>('All Areas');
  const [showResolved, setShowResolved] = useState(false);

  // Pre-fill author from authenticated profile when form opens
  const openForm = () => {
    if (!showForm && staffProfile?.displayName) setAuthor(staffProfile.displayName);
    setShowForm(s => !s);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;
    addEscalation(title.trim(), details.trim(), severity, author.trim(), area);
    toast.toast(severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'info',
      'Escalation logged', `${SEVERITY_CONFIG[severity].label}: ${title.trim()}`);
    setTitle(''); setDetails(''); setAuthor(''); setShowForm(false);
  };

  const active   = state.escalationLog.filter(e => !e.resolved);
  const resolved = state.escalationLog.filter(e => e.resolved);
  const displayed = showResolved ? [...active, ...resolved] : active;

  return (
    <div className="escalation-page">
      <div className="page-header">
        <h1><Siren size={26} /> Escalation Log</h1>
        <p>Log critical events, major incidents, and operational alerts. All staff can see active escalations.</p>
      </div>

      <div className="escalation-toolbar">
        <button className="btn-add" onClick={openForm}>
          <Plus size={16} /> Log Event
        </button>
        <button
          className={`btn-add${showResolved ? '' : ''}`}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)' }}
          onClick={() => setShowResolved(s => !s)}
        >
          {showResolved ? 'Hide' : 'Show'} Resolved ({resolved.length})
        </button>
        <div className="escalation-badges">
          {active.filter(e => e.severity === 'critical').length > 0 && (
            <span className="esc-badge-critical">{active.filter(e => e.severity === 'critical').length} CRITICAL</span>
          )}
          {active.filter(e => e.severity === 'warning').length > 0 && (
            <span className="esc-badge-warning">{active.filter(e => e.severity === 'warning').length} WARNING</span>
          )}
        </div>
      </div>

      {showForm && (
        <form className="escalation-form" onSubmit={handleSubmit}>
          <div className="escalation-form-row">
            <input className="ho-input" placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)} required />
            <input className="ho-input" placeholder="Logged by" value={author} onChange={e => setAuthor(e.target.value)} required />
          </div>
          <div className="escalation-form-row">
            <select className="ho-select" value={severity} onChange={e => setSeverity(e.target.value as EscalationSeverity)}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select className="ho-select" value={area} onChange={e => setArea(e.target.value as EscalationEntry['area'])}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <textarea className="ho-textarea" placeholder="Details (optional)…" rows={3} value={details} onChange={e => setDetails(e.target.value)} />
          <div className="handover-form-actions">
            <button type="submit" className="btn-submit-sm">Log Event</button>
            <button type="button" className="btn-add" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }} onClick={() => { setTitle(''); setDetails(''); setAuthor(''); setShowForm(false); }}>
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}

      {displayed.length === 0 ? (
        <div className="handover-empty">No {showResolved ? '' : 'active '}escalation events.</div>
      ) : (
        <div className="escalation-list">
          {displayed.map(e => {
            const cfg = SEVERITY_CONFIG[e.severity];
            return (
              <div key={e.id} className={`escalation-card sev-${e.severity}${e.resolved ? ' resolved' : ''}`}>
                <div className="escalation-card-left" style={{ background: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="escalation-card-body">
                  <div className="escalation-title-row">
                    <span className="escalation-title">{e.title}</span>
                    <span className="escalation-area-tag" style={{ background: getAreaColor(e.area) }}>{e.area}</span>
                    {e.resolved && <span className="esc-resolved-tag">Resolved</span>}
                  </div>
                  {e.details && <div className="escalation-details">{e.details}</div>}
                  <div className="escalation-meta">
                    <span>{e.author}</span>
                    <span>·</span>
                    <span>{timeStr(e.createdAt)}</span>
                    {e.resolvedAt && <><span>·</span><span>Resolved: {timeStr(e.resolvedAt)}</span></>}
                  </div>
                </div>
                <div className="escalation-card-actions">
                  {!e.resolved && (
                    <button className="ho-icon-btn success" title="Mark resolved" onClick={() => resolveEscalation(e.id)}>
                      <CheckCircle size={15} />
                    </button>
                  )}
                  <button className="ho-icon-btn danger" title="Delete" onClick={() => removeEscalation(e.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
