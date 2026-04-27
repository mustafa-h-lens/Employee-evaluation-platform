import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  exiting?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT_CLASS: Record<ToastVariant, { wrap: string; icon: React.ReactNode; bar: string }> = {
  success: {
    wrap: 't-ok',
    icon: <CheckCircle2 className="h-3 w-3" />,
    bar: 'var(--success)',
  },
  error: {
    wrap: 't-err',
    icon: <XCircle className="h-3 w-3" />,
    bar: 'var(--danger)',
  },
  warning: {
    wrap: 't-warn',
    icon: <AlertTriangle className="h-3 w-3" />,
    bar: 'var(--warning)',
  },
  info: {
    wrap: 't-info',
    icon: <Info className="h-3 w-3" />,
    bar: 'var(--accent)',
  },
};

const AUTO_DISMISS_MS = 4500;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, variant, message }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const success = useCallback((m: string) => showToast(m, 'success'), [showToast]);
  const error = useCallback((m: string) => showToast(m, 'error'), [showToast]);
  const warning = useCallback((m: string) => showToast(m, 'warning'), [showToast]);
  const info = useCallback((m: string) => showToast(m, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none"
        dir="rtl"
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const v = VARIANT_CLASS[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`toast ${v.wrap} pointer-events-auto transition-all duration-300 ease-out ${
        toast.exiting
          ? 'opacity-0 -translate-y-3 scale-95'
          : visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-3 scale-95'
      }`}
      style={{
        minWidth: '280px',
        maxWidth: '460px',
        position: 'relative',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div className="flex items-start gap-3" style={{ padding: '14px 16px' }}>
        <div className="toast-ico">{v.icon}</div>
        <p className="toast-msg flex-1 whitespace-pre-line" style={{ lineHeight: 1.5 }}>
          {toast.message}
        </p>
        <button
          onClick={onDismiss}
          className="toast-x flex-shrink-0"
          aria-label="إغلاق"
          style={{ padding: 0, width: '20px', height: '20px' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="toast-bar origin-right"
        style={{ height: '3px', width: '100%', background: v.bar }}
      />
    </div>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
