'use client';

import { ToastComponent, Toast } from './Toast';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showError = useCallback((message: string) => {
    showToast(message, 'error', 5000);
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success', 3000);
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, 'info', 3000);
  }, [showToast]);

  const showWarning = useCallback((message: string) => {
    showToast(message, 'warning', 4000);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo, showWarning }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end">
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

