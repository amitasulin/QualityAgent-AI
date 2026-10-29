'use client';

import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('p-12 text-center', className)}>
      <div className="w-14 h-14 rounded-2xl bg-secondary-100 flex items-center justify-center mx-auto">
        <Icon className="h-7 w-7 text-secondary-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-secondary-900">{title}</h3>
      {description && (
        <p className="text-sm text-secondary-500 mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
