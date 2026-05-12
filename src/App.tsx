import { useState, useCallback, useEffect, lazy, Suspense, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueueProvider } from './context/QueueContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';

/** Catches render errors in any child page so the sidebar stays visible */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.error) {
      // ChunkLoadError means the lazy bundle failed to fetch — a re-render won't
      // help since the failed module stays cached. Reload the page instead.
      const isChunkError = this.state.error instanceof Error &&
        (this.state.error.name === 'ChunkLoadError' ||
         this.state.error.message.includes('Loading chunk') ||
         this.state.error.message.includes('Failed to fetch dynamically'));
      return (
        <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Something went wrong loading this page.</p>
          <button
            style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
            onClick={() => isChunkError ? window.location.reload() : this.setState({ error: null })}
          >Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Redirects to / if the given feature flag is off */
function FeatureRoute({ flag, children }: { flag: keyof ReturnType<typeof useFeatureFlags>['flags']; children: React.ReactNode }) {
  const { flags } = useFeatureFlags();
  return flags[flag] ? <>{children}</> : <Navigate to="/" replace />;
}

import Sidebar from './components/Sidebar';
import StaffGuard from './components/StaffGuard';
import AmbulanceGuard from './components/AmbulanceGuard';
import AmbulanceSirenAlert from './components/AmbulanceSirenAlert';

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
const PatientRegistry  = lazy(() => import('./pages/PatientRegistry'));
import useKeyboardShortcuts from './utils/useKeyboardShortcuts';
import { ToastProvider, useToast } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import { Menu, X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import './styles/index.css';

/* ── New-message notifier (fires toasts when staff are on other pages) ── */
function MessageNotifier() {
  const { user, staffProfile } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const staffNameRef = useRef(staffProfile?.displayName);
  const seenTsRef = useRef<Record<string, number>>({});
  const isInitialized = useRef(false);

  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);
  useEffect(() => { staffNameRef.current = staffProfile?.displayName; }, [staffProfile]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'staffChats'), snap => {
      if (!isInitialized.current) {
        snap.docs.forEach(d => { seenTsRef.current[d.id] = d.data().lastTimestamp ?? 0; });
        isInitialized.current = true;
        return;
      }
      if (locationRef.current === '/messages') return;
      snap.docs.forEach(d => {
        const data = d.data();
        const ts: number = data.lastTimestamp ?? 0;
        const prev = seenTsRef.current[d.id] ?? 0;
        if (ts > prev) {
          seenTsRef.current[d.id] = ts;
          const preview: string = data.lastMessage ?? 'New message';
          const senderName = staffNameRef.current;
          if (!senderName || !preview.startsWith(senderName + ':')) {
            toast.info('New Message', preview);
          }
        }
      });
    });
    return () => unsub();
  }, [user, toast]);

  return null;
}

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
          <PageErrorBoundary>
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
              <Route path="/registry" element={<PatientRegistry />} />
            </Routes>
          </Suspense>
          </PageErrorBoundary>
        </main>
        <CommandPalette />
        <MessageNotifier />
        <AmbulanceSirenAlert />
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
          <PageErrorBoundary>
          <Suspense fallback={<div className="page-loading" />}>
            <Routes>
              <Route path="/" element={<AmbulanceCheckIn />} />
              <Route path="/tracker" element={<AmbulanceTracker />} />
            </Routes>
          </Suspense>
          </PageErrorBoundary>
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

/** Uses useNavigate (inside BrowserRouter) so login redirects without a full reload */
function StaffLoginRoute() {
  const nav = useNavigate();
  return <StaffLogin onLogin={() => nav('/', { replace: true })} />;
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
            <Route path="/staff-login" element={<StaffLoginRoute />} />
            <Route path="/display" element={<PageErrorBoundary><DisplayBoard /></PageErrorBoundary>} />
            <Route path="/patient" element={<PageErrorBoundary><Suspense fallback={<div className="page-loading" />}><PatientView /></Suspense></PageErrorBoundary>} />

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
