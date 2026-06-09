import { useState } from 'react';
import { Stethoscope, Lock, Mail, AlertCircle, ArrowLeft, MapPin, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFacility, FACILITIES, type Facility } from '../context/FacilityContext';

interface StaffLoginProps {
  onLogin: () => void;
}

export default function StaffLogin({ onLogin }: StaffLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signOut } = useAuth();
  const nav = useNavigate();

  const { facility, setFacility, displayName } = useFacility();
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(facility);
  const [customName, setCustomName] = useState(
    facility?.id === 'other' ? facility.name : ''
  );
  const [facilityError, setFacilityError] = useState('');

  const handleFacilityChange = (id: string) => {
    const f = FACILITIES.find(x => x.id === id);
    if (!f) return;
    setSelectedFacility(f);
    setFacilityError('');
    if (f.id !== 'other') setFacility(f);
  };

  const resolvedFacility = (): Facility | null => {
    if (!selectedFacility) return null;
    if (selectedFacility.id === 'other') {
      if (!customName.trim()) return null;
      return { id: 'other', name: customName.trim(), town: 'Custom' };
    }
    return selectedFacility;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFacilityError('');

    const rf = resolvedFacility();
    if (!rf) {
      setFacilityError('Please select your facility.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);

      // Re-read profile after sign-in to check role
      // staffProfile may not be updated yet; fetch it directly
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const { auth } = await import('../lib/firebase');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('auth/unknown');

      const snap = await getDoc(doc(db, 'staff', uid));
      if (!snap.exists()) {
        await signOut();
        setError('No staff profile found. Contact your administrator.');
        setLoading(false);
        return;
      }

      const profile = snap.data();
      const role: string = profile.role ?? '';
      const profileFacilityId: string = profile.facilityId ?? '';

      // Admins can log into any facility; all other roles must be assigned to the selected facility
      if (role !== 'admin') {
        if (!profileFacilityId) {
          await signOut();
          setError('Your account has no facility assigned. Contact your administrator.');
          setLoading(false);
          return;
        }
        if (profileFacilityId !== rf.id) {
          await signOut();
          setError('Access denied. You are not registered for this facility.');
          setLoading(false);
          return;
        }
      }

      // Save facility selection
      setFacility(rf);
      onLogin();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? (err as Error).message ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password. Access denied.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again in a few minutes.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection.');
      } else if (code.includes('Access denied')) {
        setError(code);
      } else {
        setError(`Error: ${code || 'unknown'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="amb-login-page">
      <div className="amb-login-card staff-login-card">
        <div className="amb-login-logo staff-login-logo">
          <Stethoscope size={38} />
        </div>
        <h1 className="amb-login-title">Staff Login</h1>
        <p className="amb-login-sub">Sign in to your assigned facility</p>

        <form className="amb-login-form" onSubmit={handleSubmit}>

          {/* ── Facility selector ── */}
          <div className="login-facility-group">
            <label className="login-facility-label">
              <MapPin size={13} /> Facility
            </label>
            <div className="facility-dropdown-wrap">
              <div className="facility-dropdown-icon"><MapPin size={14} /></div>
              <select
                className="facility-dropdown"
                value={selectedFacility?.id ?? ''}
                onChange={e => handleFacilityChange(e.target.value)}
              >
                <option value="" disabled>— Select your facility —</option>
                {FACILITIES.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.town ? `${f.name} – ${f.town}` : f.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="facility-dropdown-chevron" />
            </div>
            {selectedFacility?.id === 'other' && (
              <input
                className="facility-custom-input"
                style={{ marginTop: '0.5rem' }}
                type="text"
                placeholder="Enter facility name…"
                value={customName}
                onChange={e => { setCustomName(e.target.value); setFacilityError(''); }}
                maxLength={80}
              />
            )}
            {selectedFacility && selectedFacility.id !== 'other' && (
              <div className="facility-selected-pill" style={{ marginTop: '0.4rem' }}>
                <MapPin size={12} /> {displayName || `${selectedFacility.name}${selectedFacility.town ? ` – ${selectedFacility.town}` : ''}`}
              </div>
            )}
            {facilityError && <p className="facility-error" style={{ marginTop: '0.3rem' }}>{facilityError}</p>}
          </div>

          {/* ── Credentials ── */}
          <div className="amb-login-field">
            <Mail size={16} className="amb-field-icon" />
            <input
              type="email"
              placeholder="Admin email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
            />
          </div>
          <div className="amb-login-field">
            <Lock size={16} className="amb-field-icon" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="amb-login-error">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button type="submit" className="amb-login-btn staff-login-btn" disabled={loading}>
            <Lock size={16} /> {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <button className="portal-back-btn" onClick={() => nav('/login')}>
          <ArrowLeft size={14} /> Back to Portal
        </button>
      </div>
    </div>
  );
}

