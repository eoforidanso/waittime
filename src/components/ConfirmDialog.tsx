import { useState, useCallback, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className={`confirm-dialog confirm-${variant}`} onClick={e => e.stopPropagation()}>
        <div className="confirm-header">
          <div className="confirm-icon">
            {icon ?? <AlertTriangle size={22} />}
          </div>
          <h3>{title}</h3>
          <button className="confirm-x" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="confirm-body">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button className={`confirm-btn-ok confirm-btn-${variant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hook for easy use ───────────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'default';
  icon?: ReactNode;
  onConfirm: () => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, title: '', message: '', confirmLabel: 'Confirm',
    variant: 'default', onConfirm: () => {},
  });

  const confirm = useCallback((opts: {
    title: string;
    message: string | ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    icon?: ReactNode;
  }): Promise<boolean> => {
    return new Promise(resolve => {
      setState({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        variant: opts.variant ?? 'default',
        icon: opts.icon,
        onConfirm: () => { setState(s => ({ ...s, open: false })); resolve(true); },
      });
    });
  }, []);

  const cancel = useCallback(() => {
    setState(s => ({ ...s, open: false }));
  }, []);

  const Dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      icon={state.icon}
      onConfirm={state.onConfirm}
      onCancel={cancel}
    />
  );

  return { confirm, Dialog };
}
