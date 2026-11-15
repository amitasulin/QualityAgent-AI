/** Types and Hebrew labels for the audit trail screen. */

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_type: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  created_at: string;
}

export const ENTITY_LABELS: Record<string, string> = {
  nonconformity: 'אי התאמה',
  corrective_action: 'פעולה מתקנת',
  inspection: 'בדיקת איכות',
  complaint: 'תלונת לקוח',
  document: 'מסמך',
  task: 'משימה',
  user: 'משתמש',
  site: 'אתר',
  product: 'מוצר',
  customer: 'לקוח',
  supplier: 'ספק',
  attachment: 'קובץ מצורף',
  organization: 'ארגון',
  agent: 'סוכן AI',
};

export const ACTION_LABELS: Record<string, string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
  upload: 'העלאת קובץ',
  add_version: 'הוספת גרסה',
  complete: 'השלמה',
  verify: 'אימות',
  start: 'התחלה',
  submit: 'הגשה',
  status_change: 'שינוי סטטוס',
  add_result: 'הוספת תוצאת בדיקה',
  create_plan: 'יצירת תוכנית בדיקה',
  create_ncr: 'פתיחת אי התאמה',
  act: 'ביצוע פעולה',
  record_effectiveness: 'רישום בדיקת אפקטיביות',
  approve: 'אישור',
  reject: 'דחייה',
  archive: 'ארכוב',
  run: 'הרצת סוכן',
  change_password: 'שינוי סיסמה',
};

export const ACTION_TONES: Record<
  string,
  'primary' | 'success' | 'warning' | 'danger' | 'secondary'
> = {
  create: 'primary',
  update: 'warning',
  delete: 'danger',
  upload: 'primary',
  add_version: 'primary',
  complete: 'success',
  verify: 'success',
  approve: 'success',
  start: 'primary',
  submit: 'primary',
  status_change: 'warning',
  add_result: 'primary',
  create_plan: 'primary',
  create_ncr: 'primary',
  act: 'primary',
  record_effectiveness: 'success',
  reject: 'danger',
  archive: 'secondary',
  run: 'primary',
  change_password: 'warning',
};

export const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] || entityType;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function actionTone(
  action: string
): 'primary' | 'success' | 'warning' | 'danger' | 'secondary' {
  return ACTION_TONES[action] || 'secondary';
}

/** Shorten a UUID for table display without losing the ability to identify it. */
export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}
