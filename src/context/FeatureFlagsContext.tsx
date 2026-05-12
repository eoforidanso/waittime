import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface FeatureFlags {
  erQueue: boolean;
}

const LS_KEY = 'mediq_features';
const DEFAULTS: FeatureFlags = { erQueue: true };

function loadFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {/* ignore */}
  return { ...DEFAULTS };
}

interface FeatureFlagsCtx {
  flags: FeatureFlags;
  toggleFlag: (key: keyof FeatureFlags) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsCtx | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(loadFlags);

  const toggleFlag = useCallback((key: keyof FeatureFlags) => {
    setFlags(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, toggleFlag }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return ctx;
}
