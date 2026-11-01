'use client';

import { Input, Select, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;

export interface FieldDef {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'tel'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'textarea'
    | 'checkbox'
    | 'select';
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  dir?: 'ltr' | 'rtl';
  options?: Array<{ value: string; label: string }>;
  fullWidth?: boolean;
}

export function valuesFromEntity(
  entity: Record<string, unknown>,
  fields: FieldDef[]
): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const raw = entity[field.name];
    values[field.name] =
      field.type === 'checkbox'
        ? Boolean(raw)
        : raw === null || raw === undefined
          ? ''
          : String(raw);
  }
  return values;
}

/**
 * Convert form values into an API payload.
 * - create: empty optional values are omitted so backend defaults apply.
 * - update: empty values are sent as null so a field can be cleared.
 */
export function payloadFromValues(
  values: FormValues,
  fields: FieldDef[],
  mode: 'create' | 'update'
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values[field.name];

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
      continue;
    }

    const text = String(value ?? '').trim();

    if (!text) {
      if (field.required) {
        throw new Error(`יש למלא את השדה "${field.label.replace(' *', '')}"`);
      }
      if (mode === 'update') {
        payload[field.name] = null;
      }
      continue;
    }

    payload[field.name] = field.type === 'number' ? Number(text) : text;
  }

  return payload;
}

interface EntityFormFieldsProps {
  fields: FieldDef[];
  values: FormValues;
  onChange: (name: string, value: FormValue) => void;
}

export function EntityFormFields({ fields, values, onChange }: EntityFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => {
        const value = values[field.name];
        const wrapperClass = field.fullWidth ? 'md:col-span-2' : undefined;

        if (field.type === 'checkbox') {
          return (
            <label
              key={field.name}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border border-secondary-200 bg-white px-3 py-2.5 cursor-pointer hover:bg-secondary-50 transition-colors',
                wrapperClass
              )}
            >
              <input
                type="checkbox"
                name={field.name}
                checked={Boolean(value)}
                onChange={(e) => onChange(field.name, e.target.checked)}
                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-secondary-700">{field.label}</span>
            </label>
          );
        }

        if (field.type === 'textarea') {
          return (
            <div key={field.name} className={wrapperClass}>
              <Textarea
                label={field.label}
                name={field.name}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
                rows={field.rows ?? 3}
                placeholder={field.placeholder}
                helperText={field.helperText}
                required={field.required}
                dir={field.dir}
              />
            </div>
          );
        }

        if (field.type === 'select') {
          return (
            <div key={field.name} className={wrapperClass}>
              <Select
                label={field.label}
                name={field.name}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
                options={field.options ?? []}
                placeholder={field.placeholder}
                helperText={field.helperText}
                required={field.required}
              />
            </div>
          );
        }

        return (
          <div key={field.name} className={wrapperClass}>
            <Input
              label={field.label}
              name={field.name}
              type={field.type ?? 'text'}
              value={String(value ?? '')}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              helperText={field.helperText}
              required={field.required}
              dir={field.dir}
              min={field.min}
              max={field.max}
              step={field.step}
            />
          </div>
        );
      })}
    </div>
  );
}
