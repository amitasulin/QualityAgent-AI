import { describe, expect, it } from 'vitest';
import {
  USER_ROLE_OPTIONS,
  getUserInitials,
  getUserRoleBadge,
  getUserRoleLabel,
} from '@/lib/users';

describe('getUserRoleLabel', () => {
  it('translates every known role', () => {
    expect(getUserRoleLabel('admin')).toBe('מנהל מערכת');
    expect(getUserRoleLabel('quality_manager')).toBe('מנהל איכות');
    expect(getUserRoleLabel('quality_inspector')).toBe('מפקח איכות');
    expect(getUserRoleLabel('production_worker')).toBe('עובד ייצור');
    expect(getUserRoleLabel('viewer')).toBe('צופה');
  });

  it('falls back to the raw value for unknown roles', () => {
    expect(getUserRoleLabel('auditor')).toBe('auditor');
  });

  it('returns a dash when the role is missing', () => {
    expect(getUserRoleLabel(null)).toBe('—');
    expect(getUserRoleLabel(undefined)).toBe('—');
  });
});

describe('getUserRoleBadge', () => {
  it('maps each role to a badge tone', () => {
    expect(getUserRoleBadge('admin')).toBe('danger');
    expect(getUserRoleBadge('quality_manager')).toBe('primary');
    expect(getUserRoleBadge('quality_inspector')).toBe('warning');
    expect(getUserRoleBadge('production_worker')).toBe('success');
    expect(getUserRoleBadge('viewer')).toBe('secondary');
  });

  it('falls back to secondary for unknown roles', () => {
    expect(getUserRoleBadge('auditor')).toBe('secondary');
  });
});

describe('USER_ROLE_OPTIONS', () => {
  it('exposes a labelled option for every role', () => {
    expect(USER_ROLE_OPTIONS).toHaveLength(5);
    expect(USER_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      'admin',
      'quality_manager',
      'quality_inspector',
      'production_worker',
      'viewer',
    ]);
    expect(USER_ROLE_OPTIONS.every((option) => option.label.length > 0)).toBe(true);
  });
});

describe('getUserInitials', () => {
  it('uses the first and last name initials', () => {
    expect(getUserInitials('דנה כהן')).toBe('דכ');
    expect(getUserInitials('Dana Cohen')).toBe('DC');
  });

  it('uses the first two letters of a single name', () => {
    expect(getUserInitials('דנה')).toBe('דנ');
  });

  it('ignores extra whitespace', () => {
    expect(getUserInitials('  דנה   כהן  ')).toBe('דכ');
  });

  it('returns a placeholder for an empty name', () => {
    expect(getUserInitials('   ')).toBe('?');
  });
});
