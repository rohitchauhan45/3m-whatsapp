'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl w-full ${sizeClasses[size]} max-h-[min(90dvh,calc(100vh-2rem))] animate-fade-in`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h3
              id="modal-title"
              className="text-lg font-semibold leading-snug text-gray-900 sm:text-xl"
            >
              {title}
            </h3>
            {description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50/40 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function ModalDetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function isEmptyDetailValue(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return !trimmed || trimmed === '—';
}

export function ModalDetailRow({
  label,
  value,
  fullWidth = false,
  hideWhenEmpty = true,
  valueClassName,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  hideWhenEmpty?: boolean;
  valueClassName?: string;
}) {
  const display = value?.trim() || '';
  const isEmpty = isEmptyDetailValue(display);

  if (hideWhenEmpty && isEmpty) return null;

  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm ${fullWidth ? 'sm:col-span-2' : ''}`}
    >
      <p className="mb-1 text-sm font-medium text-gray-500">{label}</p>
      <p
        className={`break-words text-base leading-relaxed whitespace-pre-wrap capitalize ${
          isEmpty
            ? 'font-normal text-gray-400'
            : `font-semibold ${valueClassName ?? 'text-gray-700'}`
        }`}
      >
        {isEmpty ? 'Not set' : display}
      </p>
    </div>
  );
}
