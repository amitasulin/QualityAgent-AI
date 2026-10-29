import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return formatDate(d);
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'badge-danger';
    case 'major':
      return 'badge-danger';
    case 'minor':
      return 'badge-warning';
    case 'observation':
      return 'badge-secondary';
    default:
      return 'badge-secondary';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'badge-secondary';
    case 'open':
      return 'badge-primary';
    case 'contained':
      return 'badge-warning';
    case 'investigating':
      return 'badge-primary';
    case 'action_pending':
      return 'badge-warning';
    case 'effectiveness_review':
      return 'badge-primary';
    case 'closed':
      return 'badge-success';
    case 'reopened':
      return 'badge-danger';
    default:
      return 'badge-secondary';
  }
}

export function getCAPAStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'badge-secondary';
    case 'assigned':
      return 'badge-primary';
    case 'in_progress':
      return 'badge-primary';
    case 'pending_review':
      return 'badge-warning';
    case 'effectiveness_check':
      return 'badge-primary';
    case 'completed':
      return 'badge-success';
    case 'rejected':
      return 'badge-danger';
    default:
      return 'badge-secondary';
  }
}

export function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'todo':
      return 'badge-secondary';
    case 'in_progress':
      return 'badge-primary';
    case 'review':
      return 'badge-warning';
    case 'done':
      return 'badge-success';
    case 'cancelled':
      return 'badge-danger';
    default:
      return 'badge-secondary';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'badge-danger';
    case 'high':
      return 'badge-danger';
    case 'medium':
      return 'badge-warning';
    case 'low':
      return 'badge-secondary';
    default:
      return 'badge-secondary';
  }
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}