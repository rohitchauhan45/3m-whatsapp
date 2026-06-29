'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error';

export type ToastData = {
  message: string;
  type: ToastType;
};

type ToastProps = ToastData & {
  onClose: () => void;
};

export default function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-2 px-3 py-3 rounded-xl shadow-lg border ${
          type === 'success'
            ? 'bg-white text-green-600'
            : 'bg-white text-red-600'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle2 size={18} className="text-green-500" />
        ) : (
          <XCircle size={18} className="text-red-500" />
        )}
        <span className="text-sm font-medium whitespace-pre-wrap max-w-md">{message}</span>
      </div>
    </div>
  );
}
