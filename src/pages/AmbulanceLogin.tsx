import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';

const CREDENTIALS = { username: 'ems_dispatch', password: 'mediq2026' };

interface AmbulanceLoginProps {
  onLogin: () => void;
}

export default function AmbulanceLogin({ onLogin }: AmbulanceLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      sessionStorage.setItem('mediq_amb_auth', '1');
      onLogin();
    } else {
      setError('Invalid credentials. Access denied.');
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
            <User size={16} className="amb-field-icon" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              autoComplete="username"
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

          <button type="submit" className="amb-login-btn">
            <Lock size={16} /> Sign In
          </button>
        </form>

        <div className="amb-login-hint">
          <small>Demo — <code>ems_dispatch</code> / <code>mediq2026</code></small>
        </div>

        <button className="portal-back-btn" onClick={() => nav('/login')}>
          <ArrowLeft size={14} /> Back to Portal
        </button>
      </div>
    </div>
  );
}
