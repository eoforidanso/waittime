import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import StaffLogin from '../pages/StaffLogin';

export default function StaffGuard({ children }: { children: ReactNode }) {
  const { user, staffProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: '0.9rem', gap: '0.5rem' }}>
        <span className="live-dot" style={{ animationDuration: '1s' }} /> Connecting…
      </div>
    );
  }

  // A Firebase session alone isn't enough: it must belong to a staff profile, and the
  // shared EMS account is limited to the /ambulance routes.
  if (!user || !staffProfile || staffProfile.role === 'ems') {
    return <StaffLogin onLogin={() => {}} />;
  }

  return <>{children}</>;
}
