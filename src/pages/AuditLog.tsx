import { useState, useEffect } from 'react';
import { subscribeAuditLog, type AuditEntry } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Search, X } from 'lucide-react';

const ACTION_GROUPS: Record<string, string[]> = {
  'Patient Flow': ['Patient Triaged', 'Admitted to Bay', 'Ticket Completed', 'No-Show', 'Marked Deceased'],
  'Inpatient': ['Inpatient Admitted', 'Inpatient Discharged', 'Inpatient Transferred', 'Census Override', 'Ward Added', 'Ward Edited', 'Ward Deleted'],
  'Ambulance': ['Ambulance Dispatched', 'Ambulance Arrived', 'Ambulance Cancelled'],
  'Escalations': ['Escalation Raised', 'Escalation Resolved'],
  'Staff': ['Staff Account Created', 'Staff Role Updated', 'Staff Account Removed'],
  'System': ['End of Day'],
};

const ACTION_COLORS: Record<string, string> = {
  'Patient Triaged': '#3b82f6',
  'Admitted to Bay': '#6366f1',
  'Ticket Completed': '#10b981',
  'No-Show': '#f59e0b',
  'Marked Deceased': '#6b7280',
  'Inpatient Admitted': '#8b5cf6',
  'Inpatient Discharged': '#10b981',
  'Inpatient Transferred': '#06b6d4',
  'Census Override': '#f59e0b',
  'Ward Added': '#10b981',
  'Ward Edited': '#3b82f6',
  'Ward Deleted': '#ef4444',
  'Ambulance Dispatched': '#f59e0b',
  'Ambulance Arrived': '#10b981',
  'Ambulance Cancelled': '#6b7280',
  'Escalation Raised': '#ef4444',
  'Escalation Resolved': '#10b981',
  'Staff Account Created': '#3b82f6',
  'Staff Role Updated': '#f59e0b',
  'Staff Account Removed': '#ef4444',
  'End of Day': '#6366f1',
};

function groupLabel(action: string): string {
  for (const [group, actions] of Object.entries(ACTION_GROUPS)) {
    if (actions.includes(action)) return group;
  }
  return 'Other';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AuditLog() {
  const { isAdmin, staffProfile } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterUser, setFilterUser] = useState<string>('All');

  // Redirect non-admins
  useEffect(() => {
    if (staffProfile !== null && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, staffProfile, navigate]);

  useEffect(() => {
    const unsub = subscribeAuditLog(500, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const uniqueUsers = Array.from(new Set(entries.map(e => e.displayName))).sort();

  const filtered = entries.filter(e => {
    if (filterGroup !== 'All' && groupLabel(e.action) !== filterGroup) return false;
    if (filterUser !== 'All' && e.displayName !== filterUser) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.action.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="al-page">
      <div className="al-header">
        <h1 className="al-title">
          <ClipboardCheck size={22} />
          Audit Log
        </h1>
        <p className="al-subtitle">All tracked changes across the system — last 500 events</p>
      </div>

      {/* Filters */}
      <div className="al-filters">
        <div className="al-search-wrap">
          <Search size={15} className="al-search-icon" />
          <input
            className="al-search"
            type="text"
            placeholder="Search actions, users, details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="al-search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        <select
          className="al-select"
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
        >
          <option value="All">All Categories</option>
          {Object.keys(ACTION_GROUPS).map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          className="al-select"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
        >
          <option value="All">All Users</option>
          {uniqueUsers.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="al-loading">Loading audit log…</div>
      ) : filtered.length === 0 ? (
        <div className="al-empty">No entries match your filters.</div>
      ) : (
        <div className="al-table-wrap">
          <table className="al-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id}>
                  <td className="al-td-time">{formatTime(entry.timestamp)}</td>
                  <td className="al-td-user">{entry.displayName}</td>
                  <td>
                    <span
                      className="al-action-badge"
                      style={{ borderColor: ACTION_COLORS[entry.action] ?? '#6b7280', color: ACTION_COLORS[entry.action] ?? '#6b7280' }}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="al-td-summary">{entry.summary}</td>
                  <td>
                    <span className="al-cat-badge">{groupLabel(entry.action)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="al-count">{filtered.length} of {entries.length} entries shown</p>
        </div>
      )}
    </div>
  );
}
