export type UserRole =
  | 'admin'
  | 'quality_manager'
  | 'quality_inspector'
  | 'production_worker'
  | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  site_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  identity_id?: string;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל מערכת',
  quality_manager: 'מנהל איכות',
  quality_inspector: 'מפקח איכות',
  production_worker: 'עובד ייצור',
  viewer: 'צופה',
};

export type UserRoleBadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

export const USER_ROLE_BADGE: Record<UserRole, UserRoleBadgeVariant> = {
  admin: 'danger',
  quality_manager: 'primary',
  quality_inspector: 'warning',
  production_worker: 'success',
  viewer: 'secondary',
};

export const USER_ROLE_OPTIONS = (Object.keys(USER_ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: USER_ROLE_LABELS[value],
}));

export function getUserRoleLabel(role: string | null | undefined): string {
  if (role && role in USER_ROLE_LABELS) {
    return USER_ROLE_LABELS[role as UserRole];
  }
  return role || '—';
}

export function getUserRoleBadge(role: string | null | undefined): UserRoleBadgeVariant {
  if (role && role in USER_ROLE_BADGE) {
    return USER_ROLE_BADGE[role as UserRole];
  }
  return 'secondary';
}

export function getUserInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
