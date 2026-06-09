import { useState, useEffect } from 'react';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../components/Toast';
import { getAllRecords, deleteRecord, type DailyRecord, type SerializedTicket } from '../db/patientDB';
import { SERVICE_COLORS, TRIAGE_COLORS } from '../types';
import RecordsCharts from '../components/RecordsCharts';
import {
  Database,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
  Save,
  Users,
  CheckCircle2,
  AlertTriangle,
  Skull,
  Clock,
  BarChart2,
  List,
} from 'lucide-react';

export default function PatientRecords() {
  const { state, endOfDay } = useQueue();
  const toast = useToast();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmEndOfDay, setConfirmEndOfDay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'records'>('analytics');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const data = await getAllRecords();
    setRecords(data);
  };

  const handleEndOfDay = async () => {
    if (state.tickets.length === 0) return;
    setSaving(true);
    try {
      await endOfDay();
      await loadRecords();
      toast.success('End of day complete', `${state.tickets.length} records archived`);
      setConfirmEndOfDay(false);
    } catch {
      toast.error('End of day failed', 'Could not archive records — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (date: string) => {
    await deleteRecord(date);
    await loadRecords();
    if (expandedDate === date) setExpandedDate(null);
    setDeleteTarget(null);
  };

  const toggleExpand = (date: string) => {
    setExpandedDate(prev => (prev === date ? null : date));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (isoStr: string) => {
    return new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const filterPatients = (patients: SerializedTicket[]) => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter(
      p =>
        p.patientName.toLowerCase().includes(q) ||
        p.ticketNumber.toLowerCase().includes(q) ||
        p.service.toLowerCase().includes(q) ||
        p.priority.toLowerCase().includes(q)
    );
  };

  return (
    <div className="records-page">
      <div className="page-header">
        <h1><Database size={28} /> Patient Records</h1>
        <p>End-of-day archives and historical patient data</p>
      </div>

      {/* End of Day Action */}
      <div className="eod-section">
        <div className="eod-info">
          <span className="eod-today">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span className="eod-count">{state.tickets.length} patients today</span>
        </div>
        {!confirmEndOfDay ? (
          <button
            className="btn-eod"
            onClick={() => setConfirmEndOfDay(true)}
            disabled={state.tickets.length === 0}
          >
            <Save size={16} /> End of Day — Save & Clear
          </button>
        ) : (
          <div className="eod-confirm">
            <span>Save all {state.tickets.length} patient records and clear the queue?</span>
            <button className="btn-eod-yes" onClick={handleEndOfDay} disabled={saving}>
              {saving ? 'Saving…' : 'Yes, Save & Clear'}
            </button>
            <button className="btn-eod-no" onClick={() => setConfirmEndOfDay(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="records-tabs">
        <button
          className={`records-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart2 size={16} /> Analytics
        </button>
        <button
          className={`records-tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <List size={16} /> Patient Records
        </button>
      </div>

      {/* Analytics View */}
      {activeTab === 'analytics' && <RecordsCharts records={records} />}

      {/* Records View */}
      {activeTab === 'records' && (
        <>
          {/* Search */}
          <div className="records-search">
            <input
              type="text"
              placeholder="Search records by name, ticket #, area, or triage level…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Records List */}
      <div className="records-list">
        {records.length === 0 ? (
          <div className="records-empty">
            <Database size={48} />
            <p>No records saved yet. Use "End of Day" to archive today's patients.</p>
          </div>
        ) : (
          records.map(record => {
            const filtered = filterPatients(record.patients);
            return (
              <div key={record.id} className="record-card">
                <div className="record-header" onClick={() => toggleExpand(record.id)}>
                  <div className="record-date">
                    <Calendar size={18} />
                    <strong>{formatDate(record.date)}</strong>
                  </div>
                  <div className="record-summary">
                    <span className="record-stat"><Users size={14} /> {record.totalPatients}</span>
                    <span className="record-stat completed"><CheckCircle2 size={14} /> {record.totalCompleted}</span>
                    <span className="record-stat noshow"><AlertTriangle size={14} /> {record.totalNoShow}</span>
                    <span className="record-stat deceased"><Skull size={14} /> {record.totalDeceased}</span>
                    <span className="record-stat avgwait"><Clock size={14} /> {record.avgWaitTime > 0 ? `${record.avgWaitTime} min avg` : '—'}</span>
                  </div>
                  <div className="record-actions">
                    {deleteTarget === record.id ? (
                      <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Delete this record?</span>
                        <button className="btn-eod-yes" style={{ padding: '2px 10px', fontSize: '0.8rem' }} onClick={e => { e.stopPropagation(); handleDelete(record.id); }}>Yes</button>
                        <button className="btn-eod-no" style={{ padding: '2px 10px', fontSize: '0.8rem' }} onClick={e => { e.stopPropagation(); setDeleteTarget(null); }}>No</button>
                      </>
                    ) : (
                      <button
                        className="btn-icon danger"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(record.id); }}
                        title="Delete record"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {expandedDate === record.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {expandedDate === record.id && (
                  <div className="record-detail">
                    {filtered.length === 0 ? (
                      <p className="empty-text">No matching patients</p>
                    ) : (
                      <table className="records-table">
                        <thead>
                          <tr>
                            <th>Ticket</th>
                            <th>Patient</th>
                            <th>Age</th>
                            <th>Area</th>
                            <th>Triage</th>
                            <th>Status</th>
                            <th>Triaged At</th>
                            <th>Called At</th>
                            <th>Completed At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(p => (
                            <tr key={p.id} className={`status-${p.status}`}>
                              <td><span className="ticket-badge-sm" style={{ background: SERVICE_COLORS[p.service as keyof typeof SERVICE_COLORS] }}>{p.ticketNumber}</span></td>
                              <td className="td-name">{p.patientName}</td>
                              <td>{p.age != null ? `${p.age} yrs` : '—'}</td>
                              <td>{p.service}</td>
                              <td>
                                <span className="triage-tag" style={{ background: TRIAGE_COLORS[p.priority as keyof typeof TRIAGE_COLORS] }}>
                                  {p.priority}
                                </span>
                              </td>
                              <td><span className={`status-tag ${p.status}`}>{p.status}</span></td>
                              <td>{formatTime(p.triagedAt)}</td>
                              <td>{p.calledAt ? formatTime(p.calledAt) : '—'}</td>
                              <td>{p.completedAt ? formatTime(p.completedAt) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="record-saved-at">
                      Saved at {new Date(record.savedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </>
      )}
    </div>
  );
}
