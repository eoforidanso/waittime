import { useState } from 'react';
import { Volume2, Loader2, VolumeX } from 'lucide-react';
import { pronounceName, GhanaLang, GHANA_LANG_LABELS } from '../utils/pronunciationApi';

interface PronounceButtonProps {
  name: string;
  lang?: GhanaLang;
  size?: 'sm' | 'md';
  className?: string;
}

type BtnState = 'idle' | 'loading' | 'error';

export default function PronounceButton({
  name,
  lang = 'tw',
  size = 'sm',
  className = '',
}: PronounceButtonProps) {
  const [btnState, setBtnState] = useState<BtnState>('idle');
  const iconSize = size === 'sm' ? 12 : 14;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnState === 'loading') return;
    setBtnState('loading');
    try {
      await pronounceName(name, lang);
      setBtnState('idle');
    } catch {
      setBtnState('error');
      setTimeout(() => setBtnState('idle'), 2500);
    }
  };

  const titles: Record<BtnState, string> = {
    idle: `Pronounce "${name}" (${GHANA_LANG_LABELS[lang]})`,
    loading: 'Loading pronunciation…',
    error: 'Pronunciation unavailable — check API key',
  };

  return (
    <button
      type="button"
      className={`pronounce-btn pronounce-btn--${size}${btnState !== 'idle' ? ` pronounce-btn--${btnState}` : ''} ${className}`}
      onClick={handleClick}
      title={titles[btnState]}
      aria-label={titles[btnState]}
    >
      {btnState === 'loading' ? (
        <Loader2 size={iconSize} className="spin" />
      ) : btnState === 'error' ? (
        <VolumeX size={iconSize} />
      ) : (
        <Volume2 size={iconSize} />
      )}
    </button>
  );
}
