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

export const RECENT_SEARCHES_KEY = 'qa-recent-searches';
export const MAX_RECENT_SEARCHES = 5;

/** Parse the stored list defensively: bad JSON must never break the header. */
export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

/** Put the newest query first, drop duplicates and keep the list short. */
export function addRecentSearch(list: string[], query: string): string[] {
  const value = query.trim();
  if (value.length < 2) return list;
  return [value, ...list.filter((item) => item !== value)].slice(0, MAX_RECENT_SEARCHES);
}
