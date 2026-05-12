import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Truck, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';

// Fixed EMS account — auto-provisioned in Firebase on first use
const EMS_EMAIL    = 'ems.dispatch@mediqgh.com';
const EMS_PASSWORD = 'MediQ-EMS-2026!';

interface AmbulanceLoginProps {
  onLogin: () => void;
}

async function signInEMS(email: string, password: string) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (err: unknown) {
    // Auto-provision the EMS account on first use
    if ((err as { code?: string }).code === 'auth/user-not-found' ||
        (err as { code?: string }).code === 'auth/invalid-credential') {
      cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: 'EMS Dispatch' });
      const profileDoc = doc(db, 'staff', cred.user.uid);
      const snap = await getDoc(profileDoc);
      if (!snap.exists()) {
        await setDoc(profileDoc, {
          uid: cred.user.uid,
          email,
          displayName: 'EMS Dispatch',
          role: 'ems',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      throw err;
    }
  }
  sessionStorage.setItem('mediq_amb_auth', '1');
  return cred;
}

export default function AmbulanceLogin({ onLogin }: AmbulanceLoginProps) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInEMS(email.trim(), password);
      onLogin();
    } catch {
      setError('Invalid credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInEMS(EMS_EMAIL, EMS_PASSWORD);
      onLogin();
    } catch {
      setError('Could not connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="amb-login-page">
      <div className="amb-login-card">
        <div className="amb-login-logo">
          <Truck size={38} />
        </div>
        <h1 className="amb-login-title">EMS Access</h1>
        <p className="amb-login-sub">Ambulance Dispatch &amp; Tracker</p>

        <form className="amb-login-form" onSubmit={handleSubmit}>
          <div className="amb-login-field">
            <Mail size={16} className="amb-field-icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              autoFocus
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

          <button type="submit" className="amb-login-btn" disabled={loading}>
            <Lock size={16} /> {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="amb-login-hint">
          <small>EMS account — <code>{EMS_EMAIL}</code></small>
        </div>

        <button type="button" className="amb-demo-btn" onClick={handleDemoLogin} disabled={loading}>
          ⚡ {loading ? 'Connecting…' : 'Quick Demo Access'}
        </button>

        <button className="portal-back-btn" onClick={() => nav('/login')}>
          <ArrowLeft size={14} /> Back to Portal
        </button>
      </div>
    </div>
  );
}

