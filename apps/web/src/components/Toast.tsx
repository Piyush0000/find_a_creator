'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Auto-dismissing floating alerts in the bottom-right corner for async feedback
type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const TOAST_DURATION_MS = 3500;

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, { className: string; Icon: typeof Info }> = {
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  error: { className: 'border-rose-200 bg-rose-50 text-rose-800', Icon: AlertCircle },
  info: { className: 'border-indigo-200 bg-indigo-50 text-indigo-800', Icon: Info }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const { className, Icon } = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-lg animate-toast-in ${className}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0 mt-px" />
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} className="opacity-60 hover:opacity-100 transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
