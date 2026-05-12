import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X, Skull, Bell, UserPlus, ArrowRightLeft } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  icon?: ReactNode;
  duration?: number;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string, icon?: ReactNode) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, _exiting: true } as Toast & { _exiting: boolean } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, icon?: ReactNode) => {
    const id = `toast-${++_nextId}`;
    const duration = type === 'error' ? 5000 : 3200;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, icon, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: useCallback((t, m) => addToast('success', t, m), [addToast]),
    error: useCallback((t, m) => addToast('error', t, m), [addToast]),
    warn: useCallback((t, m) => addToast('warning', t, m), [addToast]),
    info: useCallback((t, m) => addToast('info', t, m), [addToast]),
  };

  const ICONS: Record<ToastType, ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <AlertTriangle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${(t as any)._exiting ? 'toast-exit' : 'toast-enter'}`}
          >
            <div className="toast-icon">{t.icon ?? ICONS[t.type]}</div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// Re-export icons for convenience when toasting from pages
export const ToastIcons = { CheckCircle, AlertTriangle, Info, Skull, Bell, UserPlus, ArrowRightLeft };
