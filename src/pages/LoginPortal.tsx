import { useNavigate } from 'react-router-dom';
import { Stethoscope, Truck, Eye, Sparkles } from 'lucide-react';
import MediqCross from '../components/MediqCross';

interface Props {
  onStartTour?: () => void;
}

export default function LoginPortal({ onStartTour }: Props) {
  const nav = useNavigate();

  return (
    <div className="portal-page">
      <div className="portal-container">
        <div className="portal-brand">
          <div className="portal-brand-icon">
            <MediqCross size={52} />
          </div>
          <h1 className="portal-brand-title">MediQ</h1>
          <p>Emergency Room Management System</p>
        </div>

        <div className="portal-cards">
          <button className="portal-card staff" onClick={() => nav('/staff-login')}>
            <div className="portal-card-icon staff">
              <Stethoscope size={32} />
            </div>
            <h2>Staff Login</h2>
            <p>Dashboard, Triage, ER Queue, Bays&nbsp;&amp;&nbsp;Records</p>
          </button>

          <button className="portal-card ems" onClick={() => nav('/ambulance')}>
            <div className="portal-card-icon ems">
              <Truck size={32} />
            </div>
            <h2>EMS Login</h2>
            <p>Ambulance Check-In&nbsp;&amp;&nbsp;Tracker</p>
          </button>

          <button className="portal-card public" onClick={() => nav('/patient')}>
            <div className="portal-card-icon public">
              <Eye size={32} />
            </div>
            <h2>Patient View</h2>
            <p>Live wait times&nbsp;&amp;&nbsp;queue&nbsp;status</p>
          </button>
        </div>

        {onStartTour && (
          <button className="portal-tour-btn" onClick={onStartTour}>
            <Sparkles size={15} /> Take a guided tour
          </button>
        )}

        <div className="portal-footer">
          <small>&copy; 2026 MediQ &middot; Emergency Department</small>
        </div>
      </div>
    </div>
  );
}
