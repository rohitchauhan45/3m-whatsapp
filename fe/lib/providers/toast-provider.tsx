'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast, { type ToastData, type ToastType } from '@/components/ui/Toast';

type ToastContextValue = {
  showToast: (message: string, type: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const hideToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  const showSuccess = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  );

  const showError = useCallback(
    (message: string) => showToast(message, 'error'),
    [showToast],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hideToast, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, hideToast }),
    [showToast, showSuccess, showError, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
