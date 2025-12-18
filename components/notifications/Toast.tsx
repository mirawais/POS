'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || (toast.type === 'error' ? 5000 : 3000);
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.type, onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  }[toast.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[toast.type];

  return (
    <div
      className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg mb-3 flex items-center justify-between min-w-[300px] max-w-[500px] animate-slide-in`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold">{icon}</span>
        <span className="font-medium">{toast.message}</span>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

