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

const VARIANT_STYLE: Record<ToastVariant, { icon: React.ReactNode; ring: string; bar: string; iconBg: string; }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    ring: 'border-emerald-200',
    bar: 'bg-gradient-to-l from-emerald-400 to-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-rose-600" />,
    ring: 'border-rose-200',
    bar: 'bg-gradient-to-l from-rose-400 to-rose-600',
    iconBg: 'bg-rose-50',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    ring: 'border-amber-200',
    bar: 'bg-gradient-to-l from-amber-400 to-amber-600',
    iconBg: 'bg-amber-50',
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-600" />,
    ring: 'border-blue-200',
    bar: 'bg-gradient-to-l from-blue-400 to-blue-600',
    iconBg: 'bg-blue-50',
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
  const v = VARIANT_STYLE[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`pointer-events-auto min-w-[280px] max-w-[460px] bg-white border ${v.ring} rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ease-out ${
        toast.exiting
          ? 'opacity-0 -translate-y-3 scale-95'
          : visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-3 scale-95'
      }`}
      style={{ fontFamily: 'inherit' }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`w-9 h-9 rounded-xl ${v.iconBg} flex items-center justify-center flex-shrink-0`}>
          {v.icon}
        </div>
        <p className="flex-1 text-sm text-gray-800 leading-relaxed whitespace-pre-line">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={`h-1 w-full ${v.bar} origin-right toast-bar`} />
    </div>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
