import type { FieldDef, FormValues } from '@/components/master-data/EntityFormFields';

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  under_review: 'בבדיקה',
  approved: 'מאושר',
  published: 'פורסם',
  archived: 'בארכיון',
  obsolete: 'מיושן',
};

export const DOCUMENT_STATUS_VARIANTS: Record<
  string,
  'secondary' | 'warning' | 'success' | 'primary'
> = {
  draft: 'secondary',
  under_review: 'warning',
  approved: 'primary',
  published: 'success',
  archived: 'secondary',
  obsolete: 'secondary',
};

export const DOCUMENT_STATUS_OPTIONS = Object.entries(DOCUMENT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const DOCUMENT_FIELDS: FieldDef[] = [
  {
    name: 'title',
    label: 'כותרת המסמך *',
    required: true,
    fullWidth: true,
    placeholder: 'למשל: נוהל בקרת איכות בייצור',
  },
  {
    name: 'code',
    label: 'קוד מסמך *',
    required: true,
    dir: 'ltr',
    placeholder: 'PROC-QA-001',
  },
  {
    name: 'category',
    label: 'קטגוריה',
    placeholder: 'נוהל / הוראת עבודה / מפרט',
  },
  {
    name: 'status',
    label: 'סטטוס',
    type: 'select',
    options: DOCUMENT_STATUS_OPTIONS,
  },
  {
    name: 'effective_from',
    label: 'תוקף מ־',
    type: 'date',
  },
  {
    name: 'effective_until',
    label: 'תוקף עד',
    type: 'date',
  },
  {
    name: 'description',
    label: 'תיאור',
    type: 'textarea',
    rows: 3,
    fullWidth: true,
    placeholder: 'מטרת המסמך, היקף ותחומי שימוש',
  },
  {
    name: 'tags',
    label: 'תגיות',
    fullWidth: true,
    helperText: 'תגיות מופרדות בפסיק, למשל: ISO 9001, ייצור',
    placeholder: 'ISO 9001, ייצור',
  },
];

export const DOCUMENT_INITIAL: FormValues = {
  title: '',
  code: '',
  category: '',
  status: 'draft',
  effective_from: '',
  effective_until: '',
  description: '',
  tags: '',
};

export function tagsToText(tags: unknown): string {
  return Array.isArray(tags) ? tags.filter(Boolean).join(', ') : '';
}

export function textToTags(text: unknown): string[] {
  return String(text ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
