import { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { SERVICE_COLORS, TRIAGE_COLORS } from '../types';
import type { TicketStatus } from '../types';
import { useToast } from '../components/Toast';
import { ClipboardList, Save, Edit2, X, User } from 'lucide-react';

// Statuses considered "active in ER"
const ACTIVE_STATUSES: TicketStatus[] = [
  'waiting', 'serving', 'results-pending', 'awaiting-bed', 'referred',
];

interface RegistryEntry {
  ticketId: string;
  lastName: string;
  firstInitial: string;
  dob: string;       // YYYY-MM-DD
  age: number | null;
  updatedAt: number;
  updatedBy: string;
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export default function PatientRegistry() {
  const { user, staffProfile, isAdmin } = useAuth();
  const { state } = useQueue();
  const toast = useToast();

  const [registry, setRegistry] = useState<Record<string, RegistryEntry>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ lastName: '', firstInitial: '', dob: '' });
  const [saving, setSaving] = useState(false);

  // All active ER patients
  const activeTickets = state.tickets.filter(t => ACTIVE_STATUSES.includes(t.status));

  // Subscribe to patientRegistry collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'patientRegistry'), snap => {
      const map: Record<string, RegistryEntry> = {};
      snap.docs.forEach(d => { map[d.id] = d.data() as RegistryEntry; });
      setRegistry(map);
    });
    return unsub;
  }, []);

  const startEdit = (ticketId: string) => {
    const existing = registry[ticketId];
    setForm({
      lastName: existing?.lastName ?? '',
      firstInitial: existing?.firstInitial ?? '',
      dob: existing?.dob ?? '',
    });
    setEditing(ticketId);
  };

  const cancelEdit = () => { setEditing(null); };

  const handleSave = async (ticketId: string) => {
    if (!user || !staffProfile) return;
    const lastName = form.lastName.trim();
    const firstInitial = form.firstInitial.trim().charAt(0).toUpperCase();
    const dob = form.dob;
    if (!lastName || !firstInitial || !dob) {
      toast.error('Missing fields', 'Last name, first initial and DOB are required.');
      return;
    }
    const age = calcAge(dob);
    setSaving(true);
    try {
      await setDoc(doc(db, 'patientRegistry', ticketId), {
        ticketId,
        lastName,
        firstInitial,
        dob,
        age,
        updatedAt: Date.now(),
        updatedBy: staffProfile.displayName,
      } satisfies RegistryEntry);
      toast.success('Registry updated', `${firstInitial}. ${lastName} — DOB ${dob}`);
      setEditing(null);
    } catch {
      toast.error('Save failed', 'Could not write to registry.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="registry-page">
        <div className="registry-access-denied">
          <User size={40} />
          <h2>Admin Access Required</h2>
          <p>Only administrators can view the Patient Registry.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="registry-page">
      <div className="page-header">
        <h1><ClipboardList size={26} /> Patient Registry</h1>
        <p>Active ER patients · Admin-only demographic entry</p>
      </div>

      <div className="registry-info-bar">
        <span>{activeTickets.length} active patient{activeTickets.length !== 1 ? 's' : ''} in ER</span>
        <span className="registry-info-note">
          Entries are stored separately from queue data and do not affect display boards or tickets.
        </span>
      </div>

      {activeTickets.length === 0 ? (
        <div className="registry-empty">
          <User size={36} />
          <p>No active patients in the ER right now.</p>
        </div>
      ) : (
        <div className="registry-table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Service</th>
                <th>Triage</th>
                <th>Status</th>
                <th>Last Name</th>
                <th>First Initial</th>
                <th>Date of Birth</th>
                <th>Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeTickets.map(ticket => {
                const entry = registry[ticket.id];
                const isEditingThis = editing === ticket.id;
                const previewAge = isEditingThis ? calcAge(form.dob) : entry?.age ?? null;

                return (
                  <tr key={ticket.id} className={isEditingThis ? 'registry-row editing' : 'registry-row'}>
                    <td>
                      <span className="registry-ticket-num"
                        style={{ background: SERVICE_COLORS[ticket.service] }}>
                        {ticket.ticketNumber}
                      </span>
                    </td>
                    <td>
                      <span className="registry-service"
                        style={{ color: SERVICE_COLORS[ticket.service] }}>
                        {ticket.service}
                      </span>
                    </td>
                    <td>
                      <span className="registry-priority"
                        style={{ color: TRIAGE_COLORS[ticket.priority] }}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span className="registry-status">{ticket.status}</span>
                    </td>

                    {isEditingThis ? (
                      <>
                        <td>
                          <input
                            className="registry-input"
                            placeholder="Last name"
                            value={form.lastName}
                            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                            autoFocus
                            maxLength={60}
                          />
                        </td>
                        <td>
                          <input
                            className="registry-input registry-initial"
                            placeholder="A"
                            value={form.firstInitial}
                            onChange={e => setForm(f => ({ ...f, firstInitial: e.target.value.charAt(0).toUpperCase() }))}
                            maxLength={1}
                          />
                        </td>
                        <td>
                          <input
                            className="registry-input"
                            type="date"
                            value={form.dob}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                          />
                        </td>
                        <td className="registry-age-preview">
                          {previewAge !== null ? <strong>{previewAge} yrs</strong> : <span className="text-muted">—</span>}
                        </td>
                        <td className="registry-actions">
                          <button
                            className="registry-btn registry-btn-save"
                            onClick={() => handleSave(ticket.id)}
                            disabled={saving}
                            title="Save"
                          >
                            <Save size={14} /> Save
                          </button>
                          <button
                            className="registry-btn registry-btn-cancel"
                            onClick={cancelEdit}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={entry?.lastName ? '' : 'registry-empty-cell'}>
                          {entry?.lastName || <span className="registry-placeholder">—</span>}
                        </td>
                        <td className={entry?.firstInitial ? '' : 'registry-empty-cell'}>
                          {entry?.firstInitial ? `${entry.firstInitial}.` : <span className="registry-placeholder">—</span>}
                        </td>
                        <td className={entry?.dob ? '' : 'registry-empty-cell'}>
                          {entry?.dob || <span className="registry-placeholder">—</span>}
                        </td>
                        <td>
                          {entry?.age !== null && entry?.age !== undefined
                            ? <span className="registry-age">{entry.age} yrs</span>
                            : <span className="registry-placeholder">—</span>}
                        </td>
                        <td className="registry-actions">
                          <button
                            className="registry-btn registry-btn-edit"
                            onClick={() => startEdit(ticket.id)}
                            title={entry ? 'Edit entry' : 'Add entry'}
                          >
                            <Edit2 size={14} /> {entry ? 'Edit' : 'Add'}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
