import { useState } from 'react';
import { Stethoscope, Lock, Mail, AlertCircle, ArrowLeft, MapPin, ChevronDown, KeyRound, CheckCircle2 } from 'lucide-react';
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
  const { signIn, signOut, sendPasswordReset } = useAuth();
  const nav = useNavigate();

  // Forgot-password state
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      setMode('sent');
    } catch (err: unknown) {
      const message = (err as Error).message ?? '';
      const code = (err as { code?: string }).code ?? '';
      console.error('[PasswordReset] Firebase error:', { code, message });

      // Firebase sendPasswordResetEmail doesn't throw for non-existent emails (success-silence pattern)
      // but we'll still catch other errors
      if (code === 'auth/too-many-requests') {
        setResetError('Too many attempts. Please wait a few minutes.');
      } else if (code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.');
      } else if (code === 'auth/unauthorized-domain') {
        setResetError('Domain not authorized. Contact your administrator.');
      } else if (code === 'auth/network-request-failed') {
        setResetError('Network error. Check your connection and try again.');
      } else if (code) {
        setResetError(`Error: ${code}. Check console for details.`);
      } else {
        setResetError('Could not send reset email. Try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  /* ── Forgot-password view ── */
  if (mode === 'forgot') {
    return (
      <div className="amb-login-page">
        <div className="amb-login-card staff-login-card">
          <div className="amb-login-logo staff-login-logo" style={{ background: 'rgba(96,175,245,0.12)', color: '#60aff5' }}>
            <KeyRound size={34} />
          </div>
          <h1 className="amb-login-title">Reset Password</h1>
          <p className="amb-login-sub">Enter your email and we'll send a reset link</p>

          <form className="amb-login-form" onSubmit={handlePasswordReset}>
            <div className="amb-login-field">
              <Mail size={16} className="amb-field-icon" />
              <input
                type="email"
                placeholder="Your email address"
                value={resetEmail}
                onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                autoComplete="email"
                autoFocus
              />
            </div>

            {resetError && (
              <div className="amb-login-error">
                <AlertCircle size={14} /> {resetError}
              </div>
            )}

            <button type="submit" className="amb-login-btn staff-login-btn" disabled={resetLoading}>
              <Mail size={16} /> {resetLoading ? 'Sending…' : 'Send Reset Email'}
            </button>
          </form>

          <button className="portal-back-btn" onClick={() => { setMode('login'); setResetError(''); setResetEmail(''); }}>
            <ArrowLeft size={14} /> Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  /* ── Sent confirmation view ── */
  if (mode === 'sent') {
    return (
      <div className="amb-login-page">
        <div className="amb-login-card staff-login-card">
          <div className="amb-login-logo staff-login-logo" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            <CheckCircle2 size={34} />
          </div>
          <h1 className="amb-login-title" style={{ color: '#10b981' }}>Email Sent!</h1>
          <p className="amb-login-sub" style={{ textAlign: 'center', lineHeight: 1.6 }}>
            A password reset link has been sent to<br />
            <strong className="reset-email-display">{resetEmail}</strong>.<br />
            Check your inbox (and spam folder).
          </p>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="amb-login-btn staff-login-btn"
              onClick={() => { setMode('login'); setResetEmail(''); setResetError(''); }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal login view ── */
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
              placeholder="Email address"
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

          {/* Forgot password link */}
          <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => { setMode('forgot'); setResetEmail(email); setResetError(''); }}
            >
              Forgot password?
            </button>
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
