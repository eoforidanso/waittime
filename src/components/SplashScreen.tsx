import { useState, useEffect } from 'react';
import { Cross } from 'lucide-react';

const SPLASH_DURATION = 4500; // ms before auto-dismiss

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  const dismiss = () => {
    if (fading) return;
    setFading(true);
    setTimeout(onDone, 600);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, SPLASH_DURATION);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`splash-overlay${fading ? ' splash-fade-out' : ''}`} onClick={dismiss}>
      <div className="splash-card" onClick={e => e.stopPropagation()}>

        {/* Logo */}
        <div className="splash-logo">
          <div className="splash-cross">
            <Cross size={36} />
          </div>
          <span className="splash-wordmark">MediQ</span>
        </div>

        {/* Tagline */}
        <p className="splash-tagline">Ghana's Intelligent ER Management Platform</p>

        {/* Divider */}
        <div className="splash-divider" />

        {/* Dedication */}
        <div className="splash-dedication">
          <span className="splash-in-honor">In Memory Of</span>
          <div className="splash-honoree">
            <span className="splash-heart">♥</span>
            <span className="splash-name">Charles Ammisah</span>
          </div>
          <p className="splash-tribute">
            A life well lived, a legacy of care —<br />
            this platform is dedicated to his memory.
          </p>
        </div>

        {/* Progress bar */}
        <div className="splash-progress-track">
          <div className="splash-progress-bar" style={{ animationDuration: `${SPLASH_DURATION}ms` }} />
        </div>

        <button className="splash-enter-btn" onClick={dismiss}>
          Enter MediQ
        </button>
      </div>
    </div>
  );
}
