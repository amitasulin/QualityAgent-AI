import axios from 'axios';

export interface Customer {
  id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  quality_requirements?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  quality_rating?: string | number | null;
  is_approved: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  revision: string;
  unit?: string | null;
  category?: string | null;
  drawing_number?: string | null;
  specification?: Record<string, unknown> | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Site {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Turn an API/validation error into a readable Hebrew message.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          detail?: unknown;
          error?: { code?: string; message?: string; details?: unknown };
        }
      | undefined;

    if (data?.error) {
      switch (data.error.code) {
        case 'CONFLICT':
          return 'קוד כזה כבר קיים במערכת';
        case 'NOT_FOUND':
          return 'הרשומה לא נמצאה';
        case 'FORBIDDEN':
          return 'אין לך הרשאה לביצוע הפעולה';
        case 'VALIDATION_ERROR': {
          const details = data.error.details;
          if (Array.isArray(details)) {
            const messages = details
              .map((item) =>
                item && typeof item === 'object' && 'msg' in item
                  ? String((item as { msg?: unknown }).msg ?? '')
                  : ''
              )
              .filter(Boolean);
            if (messages.length > 0) return messages.join(', ');
          }
          return 'הנתונים שהוזנו אינם תקינים';
        }
        default:
          if (typeof data.error.message === 'string' && data.error.message.trim()) {
            return data.error.message;
          }
      }
    }

    const detail = data?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg?: unknown }).msg ?? '');
          }
          return '';
        })
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join(', ');
      }
    }

    if (error.response?.status === 403) {
      return 'אין לך הרשאה לביצוע הפעולה';
    }
    if (error.response?.status === 404) {
      return 'הרשומה לא נמצאה';
    }
    return fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
