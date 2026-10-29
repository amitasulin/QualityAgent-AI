'use client';

import { type ComponentType, type ReactNode } from 'react';
import { Card, CardBody } from './Card';
import { cn } from '@/lib/utils';

export type KpiTone = 'primary' | 'success' | 'danger' | 'warning' | 'secondary';

const TONES: Record<
  KpiTone,
  { wrap: string; icon: string; value: string; bar: string }
> = {
  primary: {
    wrap: 'from-primary-50 to-white border-primary-100',
    icon: 'bg-primary-100 text-primary-700',
    value: 'text-secondary-900',
    bar: 'bg-primary-500',
  },
  success: {
    wrap: 'from-success-50 to-white border-success-50',
    icon: 'bg-success-50 text-success-600',
    value: 'text-success-600',
    bar: 'bg-success-500',
  },
  danger: {
    wrap: 'from-danger-50 to-white border-danger-50',
    icon: 'bg-danger-50 text-danger-600',
    value: 'text-danger-600',
    bar: 'bg-danger-500',
  },
  warning: {
    wrap: 'from-warning-50 to-white border-warning-50',
    icon: 'bg-warning-50 text-warning-600',
    value: 'text-secondary-900',
    bar: 'bg-warning-500',
  },
  secondary: {
    wrap: 'from-secondary-50 to-white border-secondary-200',
    icon: 'bg-secondary-100 text-secondary-600',
    value: 'text-secondary-900',
    bar: 'bg-secondary-400',
  },
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: KpiTone;
  progress?: number;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  progress,
  className,
}: KpiCardProps) {
  const tones = TONES[tone];

  return (
    <Card className={cn('bg-gradient-to-bl border', tones.wrap, className)}>
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-secondary-500">{label}</p>
            <p className={cn('text-3xl font-extrabold mt-1 tabular-nums', tones.value)}>
              {value}
            </p>
          </div>
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
              tones.icon
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {typeof progress === 'number' && (
          <div className="h-1.5 rounded-full bg-white/80 border border-secondary-100 mt-4 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', tones.bar)}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        {hint && <p className="text-xs text-secondary-400 mt-3">{hint}</p>}
      </CardBody>
    </Card>
  );
}
