import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueueProvider } from './context/QueueContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';

/** Redirects to / if the given feature flag is off */
function FeatureRoute({ flag, children }: { flag: keyof ReturnType<typeof useFeatureFlags>['flags']; children: React.ReactNode }) {
  const { flags } = useFeatureFlags();
  return flags[flag] ? <>{children}</> : <Navigate to="/" replace />;
}

import Sidebar from './components/Sidebar';
import StaffGuard from './components/StaffGuard';
import AmbulanceGuard from './components/AmbulanceGuard';

// Eagerly-loaded (needed on first paint or very small)
import LoginPortal from './pages/LoginPortal';
import StaffLogin from './pages/StaffLogin';
import DisplayBoard from './pages/DisplayBoard';

// Lazy-loaded pages (code-split into separate chunks)
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const CheckIn          = lazy(() => import('./pages/CheckIn'));
const QueueManagement  = lazy(() => import('./pages/QueueManagement'));
const CounterManagement= lazy(() => import('./pages/CounterManagement'));
const LabReference     = lazy(() => import('./pages/LabReference'));
const DrugReference    = lazy(() => import('./pages/DrugReference'));
const BedBoard         = lazy(() => import('./pages/BedBoard'));
const Handover         = lazy(() => import('./pages/Handover'));
const EscalationLog    = lazy(() => import('./pages/EscalationLog'));
const ShiftSchedule    = lazy(() => import('./pages/ShiftSchedule'));
const Analytics        = lazy(() => import('./pages/Analytics'));
const AmbulanceCheckIn = lazy(() => import('./pages/AmbulanceCheckIn'));
const AmbulanceTracker = lazy(() => import('./pages/AmbulanceTracker'));
const MedicalCalculator= lazy(() => import('./pages/MedicalCalculator'));
const InpatientBedBoard= lazy(() => import('./pages/InpatientBedBoard'));
const UserManagement   = lazy(() => import('./pages/UserManagement'));
const AuditLog         = lazy(() => import('./pages/AuditLog'));
const PatientRecords   = lazy(() => import('./pages/PatientRecords'));
const PatientView      = lazy(() => import('./pages/PatientView'));
const StaffMessages    = lazy(() => import('./pages/StaffMessages'));
import useKeyboardShortcuts from './utils/useKeyboardShortcuts';
import { ToastProvider } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import { Menu, X } from 'lucide-react';
import './styles/index.css';

/* ── Staff sidebar layout ── */
function StaffLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showKbdHelp, setShowKbdHelp] = useState(false);
  const location = useLocation();

  useKeyboardShortcuts(setShowKbdHelp);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <StaffGuard>
      <div className="app-layout">
        <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />
        <Sidebar mode="staff" className={sidebarOpen ? 'open' : ''} onNavClick={closeSidebar} />
        <main className="main-content page-enter" key={location.pathname}>
          <Suspense fallback={<div className="page-loading" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/queue" element={<FeatureRoute flag="erQueue"><QueueManagement /></FeatureRoute>} />
              <Route path="/counters" element={<CounterManagement />} />
              <Route path="/labs" element={<LabReference />} />
              <Route path="/drugs" element={<DrugReference />} />
              <Route path="/beds" element={<BedBoard />} />
              <Route path="/handover" element={<Handover />} />
              <Route path="/escalation" element={<EscalationLog />} />
              <Route path="/shifts" element={<ShiftSchedule />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/tracker" element={<AmbulanceTracker />} />
              <Route path="/calculators" element={<MedicalCalculator />} />
              <Route path="/inpatient" element={<InpatientBedBoard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/records" element={<PatientRecords />} />
              <Route path="/messages" element={<StaffMessages />} />
            </Routes>
          </Suspense>
        </main>
        <CommandPalette />
        {showKbdHelp && (
          <div className="kbd-help-panel" onClick={() => setShowKbdHelp(false)}>
            <h4>Keyboard Shortcuts</h4>
            <div className="kbd-row"><span>Dashboard</span><kbd>D</kbd></div>
            <div className="kbd-row"><span>Triage / Check-In</span><kbd>T</kbd></div>
            <div className="kbd-row"><span>ER Queue</span><kbd>N</kbd></div>
            <div className="kbd-row"><span>Bed Board</span><kbd>B</kbd></div>
            <div className="kbd-row"><span>Handover</span><kbd>H</kbd></div>
            <div className="kbd-row"><span>Escalation</span><kbd>E</kbd></div>
            <div className="kbd-row"><span>Patient Records</span><kbd>R</kbd></div>
            <div className="kbd-row"><span>Close this panel</span><kbd>Esc</kbd></div>
            <div style={{marginTop:'8px',fontSize:'0.72rem',color:'var(--text-muted)',textAlign:'center'}}>Click anywhere to close</div>
          </div>
        )}
        <button
          className="mobile-nav-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </StaffGuard>
  );
}

/* ── Ambulance sidebar layout ── */
function AmbulanceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <AmbulanceGuard>
      <div className="app-layout">
        <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />
        <Sidebar mode="ambulance" className={sidebarOpen ? 'open' : ''} onNavClick={closeSidebar} />
        <main className="main-content" key={location.pathname}>
          <Suspense fallback={<div className="page-loading" />}>
            <Routes>
              <Route path="/" element={<AmbulanceCheckIn />} />
              <Route path="/tracker" element={<AmbulanceTracker />} />
            </Routes>
          </Suspense>
        </main>
        <button
          className="mobile-nav-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </AmbulanceGuard>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppBridge />
    </AuthProvider>
  );
}

/** Reads auth user and threads it into QueueProvider as auditUser */
function AppBridge() {
  const { staffProfile } = useAuth();
  const auditUser = staffProfile
    ? { uid: staffProfile.uid, displayName: staffProfile.displayName }
    : null;
  return (
    <FeatureFlagsProvider>
    <QueueProvider auditUser={auditUser}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes — no sidebar */}
            <Route path="/login" element={<LoginPortal />} />
            <Route path="/staff-login" element={<StaffLogin onLogin={() => { window.location.href = '/'; }} />} />
            <Route path="/display" element={<DisplayBoard />} />
            <Route path="/patient" element={<Suspense fallback={<div className="page-loading" />}><PatientView /></Suspense>} />

            {/* Ambulance routes — ambulance sidebar */}
            <Route path="/ambulance/*" element={<AmbulanceLayout />} />

            {/* Staff routes — staff sidebar (default) */}
            <Route path="/*" element={<StaffLayout />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueueProvider>
    </FeatureFlagsProvider>
  );
}
