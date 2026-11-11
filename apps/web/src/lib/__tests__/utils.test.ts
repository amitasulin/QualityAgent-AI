import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cn,
  formatRelativeTime,
  truncate,
  getSeverityColor,
  getStatusColor,
  getCAPAStatusColor,
  getTaskStatusColor,
  getPriorityColor,
} from '@/lib/utils';

describe('cn', () => {
  it('merges conflicting tailwind classes with the last one winning', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('ignores falsy values', () => {
    expect(cn('text-sm', false, null, undefined, 'font-bold')).toBe('text-sm font-bold');
  });
});

describe('truncate', () => {
  it('returns the original text when it is short enough', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('cuts long text and appends an ellipsis', () => {
    expect(truncate('abcdefghij', 4)).toBe('abcd...');
  });

  it('does not cut exactly at the limit', () => {
    expect(truncate('abcd', 4)).toBe('abcd');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "עכשיו" for less than a minute', () => {
    expect(formatRelativeTime(new Date('2026-05-10T11:59:30.000Z'))).toBe('עכשיו');
  });

  it('reports minutes', () => {
    expect(formatRelativeTime(new Date('2026-05-10T11:55:00.000Z'))).toBe('לפני 5 דקות');
  });

  it('reports hours', () => {
    expect(formatRelativeTime(new Date('2026-05-10T09:00:00.000Z'))).toBe('לפני 3 שעות');
  });

  it('reports days', () => {
    expect(formatRelativeTime(new Date('2026-05-08T12:00:00.000Z'))).toBe('לפני 2 ימים');
  });

  it('falls back to an absolute date after a week', () => {
    const result = formatRelativeTime(new Date('2026-04-01T12:00:00.000Z'));
    expect(result).not.toMatch(/^לפני/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts ISO strings', () => {
    expect(formatRelativeTime('2026-05-10T11:55:00.000Z')).toBe('לפני 5 דקות');
  });
});

describe('status color helpers', () => {
  it('maps NCR severities', () => {
    expect(getSeverityColor('critical')).toBe('badge-danger');
    expect(getSeverityColor('major')).toBe('badge-danger');
    expect(getSeverityColor('minor')).toBe('badge-warning');
    expect(getSeverityColor('observation')).toBe('badge-secondary');
    expect(getSeverityColor('unknown')).toBe('badge-secondary');
  });

  it('maps NCR statuses', () => {
    expect(getStatusColor('open')).toBe('badge-primary');
    expect(getStatusColor('contained')).toBe('badge-warning');
    expect(getStatusColor('closed')).toBe('badge-success');
    expect(getStatusColor('reopened')).toBe('badge-danger');
  });

  it('maps CAPA statuses', () => {
    expect(getCAPAStatusColor('assigned')).toBe('badge-primary');
    expect(getCAPAStatusColor('pending_review')).toBe('badge-warning');
    expect(getCAPAStatusColor('completed')).toBe('badge-success');
    expect(getCAPAStatusColor('rejected')).toBe('badge-danger');
  });

  it('maps task statuses', () => {
    expect(getTaskStatusColor('todo')).toBe('badge-secondary');
    expect(getTaskStatusColor('in_progress')).toBe('badge-primary');
    expect(getTaskStatusColor('review')).toBe('badge-warning');
    expect(getTaskStatusColor('done')).toBe('badge-success');
    expect(getTaskStatusColor('cancelled')).toBe('badge-danger');
  });

  it('maps priorities', () => {
    expect(getPriorityColor('urgent')).toBe('badge-danger');
    expect(getPriorityColor('high')).toBe('badge-danger');
    expect(getPriorityColor('medium')).toBe('badge-warning');
    expect(getPriorityColor('low')).toBe('badge-secondary');
  });
});
