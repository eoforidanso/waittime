import { useState } from 'react';
import { Stethoscope, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface StaffLoginProps {
  onLogin: () => void;
}

export default function StaffLogin({ onLogin }: StaffLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password. Access denied.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again in a few minutes.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection.');
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
        <h1 className="amb-login-title">Staff Access</h1>
        <p className="amb-login-sub">ER Dashboard &amp; Management</p>

        <form className="amb-login-form" onSubmit={handleSubmit}>
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
