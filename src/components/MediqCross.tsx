import { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
}

/**
 * Premium MediQ medical-cross icon.
 * GE Healthcare × Philips × Epic — gradient, glow, 3-D glass depth.
 */
export default function MediqCross({ size = 32, className }: Props) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mediq-cross-svg${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <defs>
        {/* Deep-navy container gradient */}
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#162443" />
          <stop offset="100%" stopColor="#0a1628" />
        </linearGradient>

        {/* Electric-blue cross arms gradient */}
        <linearGradient id={`${uid}arm`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#90c9ff" />
          <stop offset="45%"  stopColor="#1E88E5" />
          <stop offset="100%" stopColor="#1255a8" />
        </linearGradient>

        {/* Glass-shine top highlight */}
        <linearGradient id={`${uid}shine`} x1="0" y1="0" x2="0" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        {/* Glow filter for the cross arms */}
        <filter id={`${uid}glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Container ── */}
      <rect width="32" height="32" rx="8" fill={`url(#${uid}bg)`} />

      {/* ── Outer border ring (electric-blue tint) ── */}
      <rect
        x="0.75" y="0.75"
        width="30.5" height="30.5"
        rx="7.5"
        stroke="rgba(96,175,245,0.40)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* ── Inner accent line (top-left bevel = 3-D depth) ── */}
      <rect
        x="2" y="2"
        width="28" height="2"
        rx="1"
        fill="rgba(255,255,255,0.10)"
      />
      <rect
        x="2" y="2"
        width="2" height="28"
        rx="1"
        fill="rgba(255,255,255,0.07)"
      />

      {/* ── Cross — vertical arm ── */}
      <rect
        x="12.5" y="4.5"
        width="7" height="23"
        rx="2.5"
        fill={`url(#${uid}arm)`}
        filter={`url(#${uid}glow)`}
      />

      {/* ── Cross — horizontal arm ── */}
      <rect
        x="4.5" y="12.5"
        width="23" height="7"
        rx="2.5"
        fill={`url(#${uid}arm)`}
        filter={`url(#${uid}glow)`}
      />

      {/* ── Glass-shine overlay (top half) ── */}
      <rect
        width="32" height="16"
        rx="8"
        fill={`url(#${uid}shine)`}
      />
    </svg>
  );
}
