import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, ShieldCheck, AlertCircle, Check, Loader2, WifiOff, Wifi } from 'lucide-react';
import { useAuth, type StaffRole, type StaffUser } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';

// Roles the admin can manually toggle offline/online
const TOGGLEABLE_ROLES: StaffRole[] = ['doctor', 'nurse', 'receptionist', 'ems'];

const ROLE_LABELS: Record<StaffRole, string> = {
  admin:         'Admin',
  doctor:        'Doctor',
  nurse:         'Nurse',
  receptionist:  'Receptionist',
  ems:           'EMS',
};

const ROLE_COLORS: Record<StaffRole, string> = {
  admin:        'var(--triage-critical)',
  doctor:       '#3b82f6',
  nurse:        '#10b981',
  receptionist: '#f59e0b',
  ems:          '#8b5cf6',
};

const ALL_ROLES: StaffRole[] = ['admin', 'doctor', 'nurse', 'receptionist', 'ems'];

export default function UserManagement() {
  const { user, staffProfile, isAdmin, listStaffUsers, createStaffAccount, updateStaffRole, deleteStaffAccount, setOnlineStatus } = useAuth();
  const { confirm, Dialog: ConfirmEl } = useConfirm();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Create-user form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>('nurse');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');

  // Per-row state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Sort: online first, then alphabetically
  const sortedList = [...staffList].sort((a, b) => {
    const aOnline = a.isOnline ?? false;
    const bOnline = b.isOnline ?? false;
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return (a.displayName ?? '').localeCompare(b.displayName ?? '');
  });
  const onlineCount = staffList.filter(s => s.isOnline).length;

  const refreshList = async () => {
    try {
      setListError('');
      const list = await listStaffUsers();
      setStaffList(list);
    } catch {
      setListError('Failed to load staff list.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { refreshList(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!formEmail || !formPassword || !formName) { setFormError('All fields are required.'); return; }
    if (formPassword.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
    setFormLoading(true);
    try {
      await createStaffAccount(formEmail, formPassword, formName, formRole);
      setFormSuccess(`Account created for ${formName}.`);
      setFormEmail(''); setFormPassword(''); setFormName(''); setFormRole('nurse');
      setShowForm(false);
      await refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account.';
      setFormError(msg.includes('email-already-in-use') ? 'That email is already registered.' : msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: StaffRole) => {
    setUpdatingId(uid);
    try { await updateStaffRole(uid, newRole); await refreshList(); }
    catch { /* silently ignore — user will see stale value */ }
    finally { setUpdatingId(null); }
  };

  const handleToggleOnline = async (target: StaffUser) => {
    setTogglingId(target.uid);
    try { await setOnlineStatus(target.uid, !target.isOnline); await refreshList(); }
    catch { /* ignore */ }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (target: StaffUser) => {
    const ok = await confirm({
      title: 'Remove Staff Account',
      message: `Permanently remove ${target.displayName ?? target.email} from MediQ? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    setDeletingId(target.uid);
    try { await deleteStaffAccount(target.uid); await refreshList(); }
    catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  return (
    <div className="um-page">
      <div className="um-header">
        <div className="um-header-left">
          <Users size={22} />
          <div>
            <h1 className="um-title">User Management</h1>
            <p className="um-sub">
              {staffList.length} staff · <span className="um-online-count">{onlineCount} online</span>
            </p>
          </div>
        </div>
        {isAdmin && (
          <button className="um-add-btn" onClick={() => { setShowForm(v => !v); setFormError(''); setFormSuccess(''); }}>
            <UserPlus size={16} /> {showForm ? 'Cancel' : 'Add Staff'}
          </button>
        )}
      </div>

      {formSuccess && (
        <div className="um-alert um-alert-ok"><Check size={14} /> {formSuccess}</div>
      )}

      {showForm && isAdmin && (
        <form className="um-form" onSubmit={handleCreate}>
          <h2 className="um-form-title"><UserPlus size={16} /> New Staff Account</h2>
          <div className="um-form-row">
            <div className="um-form-field">
              <label>Display Name</label>
              <input type="text" placeholder="Full name" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="um-form-field">
              <label>Email</label>
              <input type="email" placeholder="staff@hospital.org" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
          </div>
          <div className="um-form-row">
            <div className="um-form-field">
              <label>Password (min 8 chars)</label>
              <input type="password" placeholder="Temporary password" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
            </div>
            <div className="um-form-field">
              <label>Role</label>
              <select value={formRole} onChange={e => setFormRole(e.target.value as StaffRole)}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {formError && <div className="um-alert um-alert-err"><AlertCircle size={14} /> {formError}</div>}
          <button type="submit" className="um-submit-btn" disabled={formLoading}>
            {formLoading ? <><Loader2 size={14} className="um-spin" /> Creating…</> : <><UserPlus size={14} /> Create Account</>}
          </button>
        </form>
      )}

      {loadingList ? (
        <div className="um-loading"><Loader2 size={20} className="um-spin" /> Loading staff…</div>
      ) : listError ? (
        <div className="um-alert um-alert-err"><AlertCircle size={14} /> {listError}</div>
      ) : staffList.length === 0 ? (
        <div className="um-empty">
          <ShieldCheck size={40} />
          <p>No staff accounts yet.</p>
          <small>Use "Add Staff" above to create the first account.</small>
        </div>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedList.map(s => {
                const isOffline = !s.isOnline;
                const canToggle = isAdmin && s.uid !== user?.uid && TOGGLEABLE_ROLES.includes(s.role);
                return (
                <tr key={s.uid} className={[
                  s.uid === user?.uid ? 'um-row-self' : '',
                  isOffline ? 'um-row-offline' : '',
                ].filter(Boolean).join(' ')}>
                  <td>
                    <span className="um-name">
                      <span className={`um-status-dot ${s.isOnline ? 'online' : 'offline'}`} title={s.isOnline ? 'Online' : 'Offline'} />
                      {s.displayName ?? '—'}
                      {s.uid === user?.uid && <span className="um-you-badge">you</span>}
                      {isOffline && <span className="um-offline-badge">Off duty</span>}
                    </span>
                  </td>
                  <td className="um-email">{s.email}</td>
                  <td>
                    {isAdmin && s.uid !== user?.uid ? (
                      <select
                        className="um-role-select"
                        style={{ borderColor: ROLE_COLORS[s.role] }}
                        value={s.role}
                        disabled={updatingId === s.uid}
                        onChange={e => handleRoleChange(s.uid, e.target.value as StaffRole)}
                      >
                        {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    ) : (
                      <span className="um-role-badge" style={{ background: ROLE_COLORS[s.role] + '22', color: ROLE_COLORS[s.role] }}>
                        {s.role === 'admin' && <Shield size={11} />} {ROLE_LABELS[s.role]}
                      </span>
                    )}
                  </td>
                  <td className="um-date">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="um-action-group">
                        {canToggle && (
                          <button
                            className={`um-toggle-btn ${s.isOnline ? 'online' : 'offline'}`}
                            disabled={togglingId === s.uid}
                            onClick={() => handleToggleOnline(s)}
                            title={s.isOnline ? 'Set off duty' : 'Set on duty'}
                          >
                            {togglingId === s.uid
                              ? <Loader2 size={13} className="um-spin" />
                              : s.isOnline ? <WifiOff size={13} /> : <Wifi size={13} />}
                            {s.isOnline ? 'Set Off Duty' : 'Set On Duty'}
                          </button>
                        )}
                        {s.uid !== user?.uid ? (
                          <button
                            className="um-delete-btn"
                            disabled={deletingId === s.uid}
                            onClick={() => handleDelete(s)}
                            title="Permanently remove account"
                          >
                            {deletingId === s.uid ? <Loader2 size={14} className="um-spin" /> : <Trash2 size={14} />}
                          </button>
                        ) : (
                          <span className="um-protected" title="Cannot delete your own account">
                            <ShieldCheck size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {!isAdmin && staffProfile && (
        <p className="um-noadmin-note">
          <Shield size={14} /> Only admins can manage accounts. Contact your administrator.
        </p>
      )}
      {ConfirmEl}
    </div>
  );
}
