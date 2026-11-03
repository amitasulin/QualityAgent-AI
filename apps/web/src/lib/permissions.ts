'use client';

import { useAuthStore } from './store';

/** Roles that may create/update master data, documents and users. */
export const MANAGER_ROLES = ['admin', 'quality_manager'] as const;

/** Roles that may open nonconformities and corrective actions. */
export const INSPECTOR_ROLES = ['admin', 'quality_manager', 'quality_inspector'] as const;

export function hasAnyRole(
  role: string | null | undefined,
  roles: readonly string[]
): boolean {
  return Boolean(role && roles.includes(role));
}

export interface TaskPermissionTarget {
  assignee_id?: string | null;
  reporter_id?: string | null;
}

/**
 * Single source of truth for UI permissions. Mirrors the guards in the API so
 * the interface never offers an action that would end in a 403.
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const isManager = hasAnyRole(role, MANAGER_ROLES);
  const canManageMasterData = isManager;
  const canManageDocuments = isManager;
  const canCreateNonconformity = hasAnyRole(role, INSPECTOR_ROLES);
  const canCreateTask = Boolean(user);

  const canEditTask = (task: TaskPermissionTarget) =>
    isManager || task.assignee_id === user?.id || task.reporter_id === user?.id;

  const canCompleteTask = (task: TaskPermissionTarget) =>
    isManager || task.assignee_id === user?.id;

  return {
    user,
    role,
    isManager,
    canManageMasterData,
    canManageDocuments,
    canCreateNonconformity,
    canCreateTask,
    canEditTask,
    canCompleteTask,
  };
}
