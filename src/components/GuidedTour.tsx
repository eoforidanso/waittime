import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, UserPlus, MonitorPlay, Bed, BarChart2,
  Truck, Stethoscope, X, ChevronRight, ChevronLeft, Sparkles,
  Clock, Users, Activity, AlertTriangle, Pill, FlaskConical,
  MapPin, ArrowRight, Shield, Zap
} from 'lucide-react';

interface TourStep {
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  preview: React.ReactNode;
}

const STEPS: TourStep[] = [
  {
    label: 'Welcome',
    title: 'Ghana\'s Intelligent ER Platform',
    description: 'MediQ is a real-time emergency room management system built for Ghanaian hospitals. It reduces wait times, speeds up triage, coordinates your team, and provides clinical governance — all in one platform.',
    icon: <Sparkles size={20} />,
    color: '#1E88E5',
    preview: (
      <div className="tour-preview tour-preview--welcome">
        <div className="tour-preview-logo">
          <div className="tour-preview-cross">+</div>
          <span>MediQ</span>
        </div>
        <div className="tour-preview-tagline">Ghana's Intelligent ER Management Platform</div>
        <div className="tour-preview-stats-row">
          <div className="tour-preview-stat"><span className="tps-value">12</span><span className="tps-label">Waiting</span></div>
          <div className="tour-preview-stat"><span className="tps-value">4</span><span className="tps-label">In Bay</span></div>
          <div className="tour-preview-stat"><span className="tps-value">18m</span><span className="tps-label">Avg Wait</span></div>
          <div className="tour-preview-stat"><span className="tps-value">3</span><span className="tps-label">Critical</span></div>
        </div>
        <div className="tour-preview-badges">
          <span className="tpb tpb--blue"><Zap size={11} /> Real-time</span>
          <span className="tpb tpb--teal"><Shield size={11} /> Secure</span>
          <span className="tpb tpb--purple"><Activity size={11} /> Live data</span>
        </div>
      </div>
    ),
  },
  {
    label: 'Dashboard',
    title: 'Live ER Dashboard',
    description: 'See your entire emergency room at a glance — patients waiting, bays in use, average wait time, triage breakdown, and bed occupancy — all updating live without page refresh.',
    icon: <LayoutDashboard size={20} />,
    color: '#3b82f6',
    preview: (
      <div className="tour-preview tour-preview--dashboard">
        <div className="tour-preview-stat-grid">
          {[
            { label: 'Waiting', value: '12', color: '#3b82f6', icon: <Users size={14} /> },
            { label: 'In Bay', value: '4', color: '#f59e0b', icon: <Activity size={14} /> },
            { label: 'Done Today', value: '38', color: '#10b981', icon: <MonitorPlay size={14} /> },
            { label: 'Avg Wait', value: '18m', color: '#8b5cf6', icon: <Clock size={14} /> },
          ].map(s => (
            <div key={s.label} className="tour-stat-card" style={{ '--stat-color': s.color } as React.CSSProperties}>
              <div className="tour-stat-icon">{s.icon}</div>
              <div className="tour-stat-val">{s.value}</div>
              <div className="tour-stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="tour-triage-bars">
          {[
            { label: 'P1 Resus', pct: 20, color: '#ef4444' },
            { label: 'P2 Emergent', pct: 45, color: '#f97316' },
            { label: 'P3 Urgent', pct: 70, color: '#eab308' },
            { label: 'P4 Semi-urgent', pct: 35, color: '#22c55e' },
          ].map(t => (
            <div key={t.label} className="tour-triage-row">
              <span className="tour-triage-lbl">{t.label}</span>
              <div className="tour-triage-track">
                <div className="tour-triage-fill" style={{ width: `${t.pct}%`, background: t.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: 'Triage',
    title: 'Fast Triage & Check-In',
    description: 'Register patients with triage level (P1–P5), chief complaint, vitals, and presenting time. MediQ auto-assigns queue position and starts breach timers immediately.',
    icon: <UserPlus size={20} />,
    color: '#10b981',
    preview: (
      <div className="tour-preview tour-preview--triage">
        <div className="tour-form-mock">
          <div className="tour-form-row">
            <div className="tour-form-field"><span className="tff-label">Patient Name</span><div className="tff-input">Kofi Mensah</div></div>
            <div className="tour-form-field"><span className="tff-label">Age</span><div className="tff-input">34</div></div>
          </div>
          <div className="tour-form-field"><span className="tff-label">Chief Complaint</span><div className="tff-input">Chest pain, shortness of breath</div></div>
          <div className="tour-triage-chips">
            <span className="ttc ttc--p1">P1 Resus</span>
            <span className="ttc ttc--p2">P2 Emergent</span>
            <span className="ttc ttc--p3 active">P3 Urgent</span>
            <span className="ttc ttc--p4">P4 Semi</span>
            <span className="ttc ttc--p5">P5 Non-urgent</span>
          </div>
          <div className="tour-form-btn">Register Patient →</div>
        </div>
      </div>
    ),
  },
  {
    label: 'ER Queue',
    title: 'ER Queue Management',
    description: 'Manage the live patient queue — call patients to bays, update status, track wait times, flag breaches, and push updates to the waiting room display board automatically.',
    icon: <MonitorPlay size={20} />,
    color: '#8b5cf6',
    preview: (
      <div className="tour-preview tour-preview--queue">
        <div className="tour-queue-list">
          {[
            { num: 'A001', name: 'Ama Owusu', wait: '8m', triage: 'P2', status: 'waiting', color: '#f97316' },
            { num: 'A002', name: 'Kwame Asante', wait: '14m', triage: 'P3', status: 'serving', color: '#eab308' },
            { num: 'A003', name: 'Abena Boateng', wait: '22m', triage: 'P3', status: 'waiting', color: '#eab308' },
            { num: 'A004', name: 'Yaw Darko', wait: '31m', triage: 'P4', status: 'breach', color: '#ef4444' },
          ].map(p => (
            <div key={p.num} className={`tour-queue-row ${p.status === 'breach' ? 'tour-queue-breach' : ''}`}>
              <span className="tqr-num">{p.num}</span>
              <span className="tqr-name">{p.name}</span>
              <span className="tqr-triage" style={{ color: p.color }}>{p.triage}</span>
              <span className={`tqr-wait ${p.status === 'breach' ? 'tqr-wait--breach' : ''}`}>{p.wait}</span>
              <span className={`tqr-status tqr-status--${p.status}`}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: 'Bed Board',
    title: 'ER Bed Board',
    description: 'Live view of all bays, resuscitation areas, and observation beds. Assign patients to beds, see occupancy at a glance, and prevent bottlenecks before they happen.',
    icon: <Bed size={20} />,
    color: '#06b6d4',
    preview: (
      <div className="tour-preview tour-preview--beds">
        <div className="tour-bed-grid">
          {[
            { id: 'Bay 1', patient: 'Occupied', status: 'occupied' },
            { id: 'Bay 2', patient: 'Available', status: 'available' },
            { id: 'Bay 3', patient: 'Occupied', status: 'occupied' },
            { id: 'Resus 1', patient: 'CRITICAL', status: 'critical' },
            { id: 'Bay 5', patient: 'Available', status: 'available' },
            { id: 'Bay 6', patient: 'Cleaning', status: 'cleaning' },
            { id: 'Obs 1', patient: 'Occupied', status: 'occupied' },
            { id: 'Obs 2', patient: 'Available', status: 'available' },
          ].map(b => (
            <div key={b.id} className={`tour-bed-cell tour-bed-cell--${b.status}`}>
              <div className="tbc-id">{b.id}</div>
              <div className="tbc-status">{b.patient}</div>
            </div>
          ))}
        </div>
        <div className="tour-bed-legend">
          <span className="tbl tbl--occupied">Occupied</span>
          <span className="tbl tbl--available">Available</span>
          <span className="tbl tbl--critical">Critical</span>
        </div>
      </div>
    ),
  },
  {
    label: 'Ambulance',
    title: 'Ambulance Tracker',
    description: 'Receive live ambulance pre-alerts with ETA, patient condition, and GPS location. Prepare your team before arrival — saving critical minutes for high-acuity patients.',
    icon: <Truck size={20} />,
    color: '#ef4444',
    preview: (
      <div className="tour-preview tour-preview--ambulance">
        <div className="tour-amb-alert">
          <div className="taa-header">
            <Truck size={14} /> <span>INCOMING AMBULANCE</span>
            <span className="taa-eta">ETA 4 min</span>
          </div>
          <div className="taa-body">
            <div className="taa-row"><MapPin size={12} /> Korle Bu → Ridge Hospital</div>
            <div className="taa-row"><AlertTriangle size={12} color="#f97316" /> P1 — Chest trauma, unconscious</div>
            <div className="taa-row"><Activity size={12} /> HR: 110 · BP: 90/60 · SpO₂: 88%</div>
          </div>
          <div className="taa-actions">
            <span className="taa-btn taa-btn--accept">Accept</span>
            <span className="taa-btn taa-btn--prepare">Prepare Resus</span>
          </div>
        </div>
        <div className="tour-amb-map">
          <div className="tour-map-placeholder">
            <MapPin size={18} style={{ color: '#ef4444' }} />
            <span>Live GPS Tracking</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Analytics',
    title: 'Analytics & Reporting',
    description: 'Review patient flow trends, wait time distributions, triage category rates, breach rates, and staff performance. Export reports for clinical governance and hospital audits.',
    icon: <BarChart2 size={20} />,
    color: '#f59e0b',
    preview: (
      <div className="tour-preview tour-preview--analytics">
        <div className="tour-chart-bars">
          {[40, 65, 50, 80, 55, 90, 45, 70, 60, 85, 50, 75].map((h, i) => (
            <div key={i} className="tour-chart-bar-wrap">
              <div
                className="tour-chart-bar"
                style={{ height: `${h}%`, background: `rgba(245,158,11,${0.4 + h / 200})` }}
              />
            </div>
          ))}
        </div>
        <div className="tour-chart-label">Patient volume — last 12 hours</div>
        <div className="tour-analytics-kpis">
          <div className="tak"><span>Avg Wait</span><strong>18m</strong></div>
          <div className="tak"><span>Breach Rate</span><strong style={{color:'#ef4444'}}>12%</strong></div>
          <div className="tak"><span>Throughput</span><strong>38/day</strong></div>
        </div>
      </div>
    ),
  },
  {
    label: 'Clinical',
    title: 'Clinical Reference Tools',
    description: 'Built-in drug reference, lab normal ranges, and medical calculators (GCS, CURB-65, Wells score, qSOFA, and more) — available instantly, no internet needed.',
    icon: <Stethoscope size={20} />,
    color: '#4DB6AC',
    preview: (
      <div className="tour-preview tour-preview--clinical">
        <div className="tour-clinical-tabs">
          <span className="tct active"><Pill size={12} /> Drugs</span>
          <span className="tct"><FlaskConical size={12} /> Labs</span>
          <span className="tct"><Activity size={12} /> Calculators</span>
        </div>
        <div className="tour-drug-item">
          <div className="tdi-name">Adrenaline (Epinephrine)</div>
          <div className="tdi-meta">1mg/mL · IV/IM · Cardiac arrest, anaphylaxis</div>
          <div className="tdi-dose">Adult: 1mg IV q3–5min · Peds: 0.01mg/kg</div>
        </div>
        <div className="tour-drug-item">
          <div className="tdi-name">Morphine Sulfate</div>
          <div className="tdi-meta">10mg/mL · IV/IM · Severe pain</div>
          <div className="tdi-dose">Adult: 2–4mg IV titrated · Max 10mg</div>
        </div>
        <div className="tour-calc-pill">
          <Activity size={11} /> GCS Calculator · qSOFA · CURB-65 · Wells →
        </div>
      </div>
    ),
  },
  {
    label: 'Get Started',
    title: 'Ready to transform your ER?',
    description: 'Sign in with your facility credentials to access the full platform. Contact your hospital administrator to set up staff accounts. MediQ is purpose-built for Ghanaian emergency departments.',
    icon: <Sparkles size={20} />,
    color: '#1E88E5',
    preview: (
      <div className="tour-preview tour-preview--welcome">
        <div className="tour-ready-features">
          {[
            { icon: <LayoutDashboard size={16} />, label: 'Live Dashboard' },
            { icon: <UserPlus size={16} />, label: 'Fast Triage' },
            { icon: <MonitorPlay size={16} />, label: 'Queue Management' },
            { icon: <Bed size={16} />, label: 'Bed Board' },
            { icon: <Truck size={16} />, label: 'Ambulance Tracker' },
            { icon: <BarChart2 size={16} />, label: 'Analytics' },
            { icon: <Stethoscope size={16} />, label: 'Clinical Tools' },
            { icon: <Shield size={16} />, label: 'Audit Logs' },
          ].map(f => (
            <div key={f.label} className="tour-ready-feature">
              {f.icon}
              <span>{f.label}</span>
            </div>
          ))}
        </div>
        <div className="tour-ready-cta">
          <ArrowRight size={14} /> Sign in to get started
        </div>
      </div>
    ),
  },
];

interface Props {
  onClose: () => void;
}

export default function GuidedTour({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = useCallback(() => {
    if (step < STEPS.length - 1) { setDir('next'); setStep(s => s + 1); }
    else onClose();
  }, [step, onClose]);

  const prev = useCallback(() => {
    if (step > 0) { setDir('prev'); setStep(s => s - 1); }
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="MediQ guided tour">
      <div className="tour-backdrop" onClick={onClose} />

      <div className="tour-modal">
        {/* Sidebar step list */}
        <div className="tour-sidebar">
          <div className="tour-sidebar-brand">
            <div className="tour-sidebar-cross">+</div>
            <span>MediQ Tour</span>
          </div>
          <nav className="tour-sidebar-steps">
            {STEPS.map((s, i) => (
              <button
                key={i}
                className={`tour-sidebar-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                onClick={() => { setDir(i > step ? 'next' : 'prev'); setStep(i); }}
              >
                <span className="tss-num">{i + 1}</span>
                <span className="tss-label">{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="tour-content">
          <button className="tour-close-btn" onClick={onClose} aria-label="Close tour">
            <X size={16} />
          </button>

          {/* Feature preview */}
          <div className="tour-preview-wrap" key={`${step}-${dir}`} data-dir={dir}>
            {current.preview}
          </div>

          {/* Text */}
          <div className="tour-text">
            <div className="tour-text-header">
              <div className="tour-text-icon" style={{ background: `${current.color}22`, border: `1px solid ${current.color}44`, color: current.color }}>
                {current.icon}
              </div>
              <div>
                <div className="tour-step-counter">Step {step + 1} of {STEPS.length}</div>
                <h2 className="tour-step-title">{current.title}</h2>
              </div>
            </div>
            <p className="tour-step-desc">{current.description}</p>

            {/* Progress bar */}
            <div className="tour-progress-bar-track">
              <div className="tour-progress-bar-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: current.color }} />
            </div>

            <div className="tour-actions">
              <button className="tour-btn-skip" onClick={onClose}>Skip tour</button>
              <div className="tour-nav-btns">
                {step > 0 && (
                  <button className="tour-btn-prev" onClick={prev}>
                    <ChevronLeft size={15} /> Back
                  </button>
                )}
                <button
                  className="tour-btn-next"
                  style={{ background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)` }}
                  onClick={next}
                >
                  {isLast ? 'Start using MediQ' : 'Next'} {!isLast && <ChevronRight size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
