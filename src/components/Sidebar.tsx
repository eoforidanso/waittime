import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { useFacility } from '../context/FacilityContext';
import { LiveAvgWait } from '../utils/waitTime';
import LiveClock from './LiveClock';
import { useTheme } from '../utils/useTheme';
import { useMessagesBadge } from '../utils/useMessagesBadge';
import {
  LayoutDashboard,
  UserPlus,
  MonitorPlay,
  Tv,
  Settings,
  Cross,
  Truck,
  MapPin,
  Bed,
  Users,
  Clock,
  LogOut,
  Siren,
  FlaskConical,
  Pill,
  BedDouble,
  ClipboardList,
  CalendarDays,
  Sun,
  Moon,
  BarChart2,
  MessageSquare,
  Search,
  Calculator,
  Building2,
  ClipboardCheck,
  FileText,
  Stethoscope,
} from 'lucide-react';

type SidebarTab = 'queue' | 'clinical' | 'team' | 'reports';

/** Maps route paths → which tab owns them */
const ROUTE_TAB: Record<string, SidebarTab> = {
  '/': 'queue',
  '/checkin': 'queue',
  '/queue': 'queue',
  '/display': 'queue',
  '/counters': 'queue',
  '/beds': 'clinical',
  '/inpatient': 'clinical',
  '/labs': 'clinical',
  '/drugs': 'clinical',
  '/calculators': 'clinical',
  '/tracker': 'team',
  '/handover': 'team',
  '/escalation': 'team',
  '/shifts': 'team',
  '/messages': 'team',
  '/analytics': 'reports',
  '/records': 'reports',
  '/registry': 'reports',
  '/users': 'reports',
  '/audit': 'reports',
};

interface SidebarProps {
  mode: 'staff' | 'ambulance';
  className?: string;
  onNavClick?: () => void;
}

export default function Sidebar({ mode, className = '', onNavClick }: SidebarProps) {
  const nav = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const { state } = useQueue();
  const { isAdmin, signOut: firebaseSignOut } = useAuth();
  const { flags } = useFeatureFlags();
  const { displayName: facilityName } = useFacility();
  const messagesBadge = useMessagesBadge();

  // Derive active tab from current route; fall back to 'queue'
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    () => ROUTE_TAB[location.pathname] ?? 'queue'
  );

  // Keep tab in sync when navigating via keyboard shortcuts or direct URL
  useEffect(() => {
    const tab = ROUTE_TAB[location.pathname];
    if (tab) setActiveTab(tab);
  }, [location.pathname]);

  // Live badge counts
  const waitingCount = state.tickets.filter(t => t.status === 'waiting').length;
  const servingCount = state.tickets.filter(t => t.status === 'serving').length;
  const openEscalations = state.escalationLog.filter(e => !e.resolved).length;
  const critEscalations = state.escalationLog.filter(e => !e.resolved && e.severity === 'critical').length;
  const enRouteAmb = state.ambulances.filter(a => a.status === 'en-route').length;

  const handleLogout = () => {
    if (mode === 'staff') {
      firebaseSignOut().catch(() => {});
    } else {
      sessionStorage.removeItem('mediq_amb_auth');
    }
    nav('/login');
  };

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-brand">
        <Cross size={28} />
        <span>MediQ</span>
      </div>

      {facilityName && (
        <div className="sidebar-facility">
          <MapPin size={11} />
          <span>{facilityName}</span>
        </div>
      )}

      {mode === 'staff' && (
        <div
          className="sidebar-search-hint"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        >
          <Search size={14} /> Search…
          <kbd>Ctrl+K</kbd>
        </div>
      )}

      {mode === 'staff' && (
        <div className="sidebar-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'queue'}
            className={`sidebar-tab${activeTab === 'queue' ? ' active' : ''}`}
            onClick={() => setActiveTab('queue')}
            title="Queue & ER operations"
          >
            <MonitorPlay size={15} />
            <span>Queue</span>
            {(waitingCount + servingCount) > 0 && (
              <span className="sidebar-tab-badge">{waitingCount + servingCount}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'clinical'}
            className={`sidebar-tab${activeTab === 'clinical' ? ' active' : ''}`}
            onClick={() => setActiveTab('clinical')}
            title="Clinical reference & beds"
          >
            <Stethoscope size={15} />
            <span>Clinical</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'team'}
            className={`sidebar-tab${activeTab === 'team' ? ' active' : ''}`}
            onClick={() => setActiveTab('team')}
            title="Team coordination"
          >
            <Users size={15} />
            <span>Team</span>
            {openEscalations > 0 && (
              <span className={`sidebar-tab-badge${critEscalations > 0 ? ' crit' : ''}`}>
                {openEscalations}
              </span>
            )}
            {messagesBadge > 0 && openEscalations === 0 && (
              <span className="sidebar-tab-badge">{messagesBadge}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'reports'}
            className={`sidebar-tab${activeTab === 'reports' ? ' active' : ''}`}
            onClick={() => setActiveTab('reports')}
            title="Analytics & admin"
          >
            <BarChart2 size={15} />
            <span>Reports</span>
          </button>
        </div>
      )}

      <nav className="sidebar-nav">
        {mode === 'staff' ? (
          <>
            {/* ── Queue tab ── */}
            {activeTab === 'queue' && (
              <>
                <NavLink to="/" end onClick={onNavClick}>
                  <LayoutDashboard size={18} /> Dashboard
                  {(waitingCount + servingCount) > 0 && (
                    <span className="sidebar-badge">{waitingCount + servingCount}</span>
                  )}
                </NavLink>
                <NavLink to="/checkin" onClick={onNavClick}>
                  <UserPlus size={18} /> Triage
                </NavLink>
                {flags.erQueue && (
                <NavLink to="/queue" onClick={onNavClick}>
                  <MonitorPlay size={18} /> ER Queue
                  {waitingCount > 0 && (
                    <span className="sidebar-badge sidebar-badge-warn">{waitingCount}</span>
                  )}
                </NavLink>
                )}
                <NavLink to="/display" onClick={onNavClick}>
                  <Tv size={18} /> Display Board
                </NavLink>
                <NavLink to="/counters" onClick={onNavClick}>
                  <Settings size={18} /> Bay Management
                </NavLink>
                <StaffAmbulanceAlert />
              </>
            )}

            {/* ── Clinical tab ── */}
            {activeTab === 'clinical' && (
              <>
                <NavLink to="/beds" onClick={onNavClick}>
                  <BedDouble size={18} /> ER Bed Board
                </NavLink>
                <NavLink to="/inpatient" onClick={onNavClick}>
                  <Building2 size={18} /> Inpatient Wards
                </NavLink>
                <div className="sidebar-nav-divider">Reference</div>
                <NavLink to="/labs" onClick={onNavClick}>
                  <FlaskConical size={18} /> Lab Reference
                </NavLink>
                <NavLink to="/drugs" onClick={onNavClick}>
                  <Pill size={18} /> Drug Reference
                </NavLink>
                <NavLink to="/calculators" onClick={onNavClick}>
                  <Calculator size={18} /> Med Calculators
                </NavLink>
              </>
            )}

            {/* ── Team tab ── */}
            {activeTab === 'team' && (
              <>
                <NavLink to="/tracker" onClick={onNavClick}>
                  <MapPin size={18} /> Ambulance Tracker
                  {enRouteAmb > 0 && (
                    <span className="sidebar-badge sidebar-badge-crit">{enRouteAmb}</span>
                  )}
                </NavLink>
                <NavLink to="/handover" onClick={onNavClick}>
                  <ClipboardList size={18} /> Handover
                </NavLink>
                <NavLink to="/escalation" onClick={onNavClick}>
                  <Siren size={18} /> Escalation Log
                  {openEscalations > 0 && (
                    <span className={`sidebar-badge ${critEscalations > 0 ? 'sidebar-badge-crit' : 'sidebar-badge-warn'}`}>
                      {openEscalations}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/shifts" onClick={onNavClick}>
                  <CalendarDays size={18} /> Shift Schedule
                </NavLink>
                <NavLink to="/messages" onClick={onNavClick}>
                  <MessageSquare size={18} /> Messages
                  {messagesBadge > 0 && <span className="sidebar-badge">{messagesBadge}</span>}
                </NavLink>
              </>
            )}

            {/* ── Reports tab ── */}
            {activeTab === 'reports' && (
              <>
                <NavLink to="/analytics" onClick={onNavClick}>
                  <BarChart2 size={18} /> Analytics
                </NavLink>
                <NavLink to="/records" onClick={onNavClick}>
                  <FileText size={18} /> Patient Records
                </NavLink>
                {isAdmin && (
                  <>
                    <div className="sidebar-nav-divider">Admin</div>
                    <NavLink to="/registry" onClick={onNavClick}>
                      <ClipboardList size={18} /> Patient Registry
                    </NavLink>
                    <NavLink to="/users" onClick={onNavClick}>
                      <Users size={18} /> User Management
                    </NavLink>
                    <NavLink to="/audit" onClick={onNavClick}>
                      <ClipboardCheck size={18} /> Audit Log
                    </NavLink>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <NavLink to="/ambulance" end onClick={onNavClick}>
              <Truck size={18} /> Dispatch
            </NavLink>
            <NavLink to="/ambulance/tracker" onClick={onNavClick}>
              <MapPin size={18} /> Live Tracker
            </NavLink>
            <AmbulanceSidebarStats />
          </>
        )}
      </nav>

      <div className="sidebar-clock">
        <LiveClock />
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={15} /> Sign Out
        </button>
        <small>© 2026 MediQ</small>
      </div>
    </aside>
  );
}

/* ── ER stats shown in ambulance sidebar ── */
function AmbulanceSidebarStats() {
  const { state } = useQueue();

  const totalBeds = state.counters.reduce((s, c) => s + c.beds, 0);
  const occupied  = state.counters.reduce((s, c) => s + c.bedsOccupied, 0);
  const available = totalBeds - occupied;
  const patientsInER = state.tickets.filter(t => t.status === 'waiting' || t.status === 'serving').length;
  const waitingCreatedAts = state.tickets.filter(t => t.status === 'waiting').map(t => t.createdAt);
  const completedWaits = state.tickets
    .filter(t => (t.status === 'completed' || t.status === 'serving') && t.calledAt && t.createdAt)
    .map(t => (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);

  return (
    <div className="sidebar-er-stats">
      <h4 className="sidebar-stats-title">ER Status</h4>
      <div className="sidebar-stat-row">
        <Bed size={15} />
        <span className="sidebar-stat-label">Beds Available</span>
        <span className={`sidebar-stat-value${available === 0 ? ' alert' : ''}`}>{available}/{totalBeds}</span>
      </div>
      <div className="sidebar-stat-row">
        <Users size={15} />
        <span className="sidebar-stat-label">Patients in ER</span>
        <span className="sidebar-stat-value">{patientsInER}</span>
      </div>
      <div className="sidebar-stat-row">
        <Clock size={15} />
        <span className="sidebar-stat-label">Avg Wait</span>
        <span className="sidebar-stat-value">
          <LiveAvgWait waitingCreatedAts={waitingCreatedAts} completedWaits={completedWaits} />
        </span>
      </div>
    </div>
  );
}

/* ── Blinking ambulance alert for staff sidebar ── */
function StaffAmbulanceAlert() {
  const { state } = useQueue();
  const enRoute = state.ambulances.filter(a => a.status === 'en-route');

  if (enRoute.length === 0) return null;

  return (
    <NavLink to="/tracker" className="sidebar-amb-alert">
      <Siren size={16} className="sidebar-amb-siren" />
      <span>
        {enRoute.length} Ambulance{enRoute.length > 1 ? 's' : ''} Incoming
      </span>
    </NavLink>
  );
}
