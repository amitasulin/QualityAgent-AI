'use client';

import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastState {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4500,
  error: 6500,
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: ({ type, message, title }) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((state) => ({ toasts: [...state.toasts, { id, type, message, title }] }));

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      }, AUTO_DISMISS_MS[type]);
    }

    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

/**
 * Fire a toast from anywhere (event handlers, mutation callbacks, etc.).
 * Toasts render through <ToastViewport /> mounted in Providers.
 */
export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().add({ type: 'success', message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().add({ type: 'error', message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().add({ type: 'info', message, title }),
};

const TOAST_STYLES: Record<
  ToastType,
  { container: string; icon: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    container: 'border-success-200 bg-white',
    icon: 'text-success-600',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-danger-200 bg-white',
    icon: 'text-danger-600',
    Icon: AlertTriangle,
  },
  info: {
    container: 'border-primary-200 bg-white',
    icon: 'text-primary-600',
    Icon: Info,
  },
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      role="region"
      aria-label="התראות מערכת"
    >
      {toasts.map((item) => {
        const { container, icon, Icon } = TOAST_STYLES[item.type];
        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 shadow-lg animate-fade-in',
              container
            )}
          >
            <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', icon)} />
            <div className="min-w-0 flex-1">
              {item.title && (
                <p className="text-sm font-semibold text-secondary-900">{item.title}</p>
              )}
              <p className="text-sm text-secondary-600 break-words">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="סגור התראה"
              className="shrink-0 rounded-md p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
