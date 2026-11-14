export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  href: string;
}

export interface SearchGroup {
  type: string;
  label: string;
  items: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  total: number;
  groups: SearchGroup[];
}

/** Status values are shared across modules, so one map covers them all. */
export const SEARCH_STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  open: 'פתוח',
  contained: 'בלום',
  investigating: 'בחקירה',
  action_pending: 'ממתין לפעולה',
  effectiveness_review: 'בדיקת אפקטיביות',
  effectiveness_check: 'בדיקת אפקטיביות',
  closed: 'סגור',
  reopened: 'נפתח מחדש',
  assigned: 'הוקצה',
  in_progress: 'בביצוע',
  pending_review: 'ממתין לסקירה',
  completed: 'הושלם',
  rejected: 'נדחה',
  under_review: 'בסקירה',
  approved: 'מאושר',
  published: 'פורסם',
  archived: 'בארכיון',
  obsolete: 'מיושן',
  todo: 'לביצוע',
  review: 'בבדיקה',
  done: 'הושלם',
  cancelled: 'בוטל',
  new: 'חדש',
  resolved: 'טופל',
  planned: 'מתוכנן',
  passed: 'עבר',
  failed: 'נכשל',
  on_hold: 'בהמתנה',
};

export function searchStatusLabel(status?: string | null): string | null {
  if (!status) return null;
  return SEARCH_STATUS_LABELS[status] ?? status;
}

export function totalSearchResults(data: SearchResponse | null): number {
  return data?.total ?? 0;
}
