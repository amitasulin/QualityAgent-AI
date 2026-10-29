'use client';

import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  primary: {
    tile: 'from-primary-500 to-primary-700 shadow-primary-500/25',
  },
  danger: {
    tile: 'from-danger-500 to-danger-600 shadow-danger-500/25',
  },
  warning: {
    tile: 'from-warning-500 to-warning-600 shadow-warning-500/25',
  },
  success: {
    tile: 'from-success-500 to-success-600 shadow-success-500/25',
  },
  secondary: {
    tile: 'from-secondary-500 to-secondary-700 shadow-secondary-500/25',
  },
};

interface PageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  tone?: keyof typeof TONES;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  tone = 'primary',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-14 h-14 rounded-2xl bg-gradient-to-br shadow-lg flex items-center justify-center shrink-0',
            TONES[tone].tile
          )}
        >
          <Icon className="h-7 w-7 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-secondary-900">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-secondary-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
