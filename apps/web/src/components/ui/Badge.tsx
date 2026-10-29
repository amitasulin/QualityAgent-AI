'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'secondary', size = 'md', children, ...props }: BadgeProps) {
  const variantClasses = {
    primary: 'bg-primary-100 text-primary-800',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    secondary: 'bg-secondary-100 text-secondary-600',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, type = 'ncr' }: { status: string; type?: 'ncr' | 'capa' | 'task' | 'inspection' | 'complaint' }) {
  const getColor = () => {
    if (type === 'ncr') {
      switch (status) {
        case 'draft': return 'secondary';
        case 'open': return 'primary';
        case 'contained': return 'warning';
        case 'investigating': return 'primary';
        case 'action_pending': return 'warning';
        case 'effectiveness_review': return 'primary';
        case 'closed': return 'success';
        case 'reopened': return 'danger';
        default: return 'secondary';
      }
    }
    if (type === 'capa') {
      switch (status) {
        case 'draft': return 'secondary';
        case 'assigned': return 'primary';
        case 'in_progress': return 'primary';
        case 'pending_review': return 'warning';
        case 'effectiveness_check': return 'primary';
        case 'completed': return 'success';
        case 'rejected': return 'danger';
        default: return 'secondary';
      }
    }
    if (type === 'task') {
      switch (status) {
        case 'todo': return 'secondary';
        case 'in_progress': return 'primary';
        case 'review': return 'warning';
        case 'done': return 'success';
        case 'cancelled': return 'danger';
        default: return 'secondary';
      }
    }
    if (type === 'inspection') {
      switch (status) {
        case 'planned': return 'secondary';
        case 'in_progress': return 'primary';
        case 'passed': return 'success';
        case 'failed': return 'danger';
        case 'on_hold': return 'warning';
        default: return 'secondary';
      }
    }
    if (type === 'complaint') {
      switch (status) {
        case 'new': return 'primary';
        case 'under_review': return 'primary';
        case 'investigating': return 'warning';
        case 'action_pending': return 'warning';
        case 'resolved': return 'success';
        case 'closed': return 'success';
        case 'rejected': return 'secondary';
        default: return 'secondary';
      }
    }
    return 'secondary';
  };

  const getLabel = () => {
    if (type === 'complaint') {
      const complaintLabels: Record<string, string> = {
        new: 'חדשה',
        under_review: 'בבדיקה',
        investigating: 'בחקירה',
        action_pending: 'ממתין לפעולה',
        resolved: 'טופלה',
        closed: 'סגורה',
        rejected: 'נדחתה',
      };
      return complaintLabels[status] || status;
    }
    const labels: Record<string, string> = {
      draft: 'טיוטה',
      open: 'פתוח',
      contained: 'מבודד',
      investigating: 'בחקירה',
      action_pending: 'ממתין לפעולה',
      effectiveness_review: 'בדיקת אפקטיביות',
      closed: 'סגור',
      reopened: 'נפתח מחדש',
      assigned: 'הוקצה',
      in_progress: 'בביצוע',
      pending_review: 'ממתין לבדיקה',
      effectiveness_check: 'בדיקת אפקטיביות',
      completed: 'הושלם',
      rejected: 'נדחה',
      todo: 'לביצוע',
      review: 'לסקירה',
      done: 'בוצע',
      cancelled: 'בוטל',
      planned: 'מתוכננת',
      passed: 'עבר',
      failed: 'נכשל',
      on_hold: 'בהמתנה',
    };
    return labels[status] || status;
  };

  return <Badge variant={getColor()}>{getLabel()}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, 'danger' | 'warning' | 'secondary'> = {
    critical: 'danger',
    major: 'danger',
    minor: 'warning',
    observation: 'secondary',
  };

  const labels: Record<string, string> = {
    critical: 'קריטי',
    major: 'חמור',
    minor: 'קל',
    observation: 'הערה',
  };

  return <Badge variant={colors[severity] || 'secondary'}>{labels[severity] || severity}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, 'danger' | 'warning' | 'secondary'> = {
    urgent: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'secondary',
  };

  const labels: Record<string, string> = {
    urgent: 'דחוף',
    high: 'גבוה',
    medium: 'בינוני',
    low: 'נמוך',
  };

  return <Badge variant={colors[priority] || 'secondary'}>{labels[priority] || priority}</Badge>;
}