import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import StaffLogin from '../pages/StaffLogin';

export default function StaffGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: '0.9rem', gap: '0.5rem' }}>
        <span className="live-dot" style={{ animationDuration: '1s' }} /> Connecting…
      </div>
    );
  }

  if (!user) {
    return <StaffLogin onLogin={() => {}} />;
  }

  return <>{children}</>;
}
