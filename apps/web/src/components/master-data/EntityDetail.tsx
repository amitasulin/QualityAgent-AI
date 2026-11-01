'use client';

import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pencil,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn, formatDateTime } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/master-data';
import {
  EntityFormFields,
  type FieldDef,
  type FormValue,
  type FormValues,
  payloadFromValues,
  valuesFromEntity,
} from './EntityFormFields';

export interface StatDef {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'success' | 'danger' | 'warning' | 'primary' | 'neutral';
}

interface EntityDetailProps<T extends { id: string }> {
  icon: ComponentType<{ className?: string }>;
  entityName: string;
  entity: T;
  fields: FieldDef[];
  backHref: string;
  badges?: ReactNode;
  stats?: StatDef[];
  extra?: ReactNode;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

const STAT_TONES = {
  success: 'text-success-600',
  danger: 'text-danger-600',
  warning: 'text-warning-600',
  primary: 'text-primary-600',
  neutral: 'text-secondary-900',
};

const secondaryLinkClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200 transition-colors px-4 py-2 text-sm';

export function EntityDetail<T extends { id: string }>({
  icon: Icon,
  entityName,
  entity,
  fields,
  backHref,
  badges,
  stats,
  extra,
  onSave,
}: EntityDetailProps<T>) {
  const record = entity as unknown as Record<string, unknown>;
  const title = String(record.name ?? record.sku ?? '');
  const reference = String(record.code ?? record.sku ?? '');

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues>(() => valuesFromEntity(record, fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const startEditing = () => {
    setValues(valuesFromEntity(record, fields));
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const handleChange = (name: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = payloadFromValues(values, fields, 'update');
      await onSave(payload);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'שמירת השינויים נכשלה'));
    } finally {
      setSaving(false);
    }
  };

  const renderValue = (field: FieldDef, value: unknown) => {
    if (field.type === 'checkbox') {
      const on = Boolean(value);
      if (field.name === 'is_approved') {
        return <Badge variant={on ? 'success' : 'secondary'}>{on ? 'מאושר' : 'לא מאושר'}</Badge>;
      }
      return <Badge variant={on ? 'success' : 'secondary'}>{on ? 'פעיל' : 'לא פעיל'}</Badge>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-secondary-300">—</span>;
    }

    return (
      <span className={cn(field.type === 'textarea' && 'whitespace-pre-line')}>
        {String(value)}
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Icon}
          title={title}
          subtitle={`${entityName}${reference ? ` · ${reference}` : ''}`}
          badge={
            <div className="flex items-center gap-2 flex-wrap">
              {reference && (
                <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                  {reference}
                </span>
              )}
              {badges}
            </div>
          }
          actions={
            <>
              <Link href={backHref} className={secondaryLinkClasses}>
                <ArrowRight className="h-4 w-4" />
                חזרה לרשימה
              </Link>
              {!editing && (
                <Button onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                  עריכה
                </Button>
              )}
            </>
          }
        />

        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4" />
            השינויים נשמרו בהצלחה
          </div>
        )}

        {error && !editing && (
          <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {editing ? (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>עריכת {entityName}</CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelEditing} aria-label="סגור עריכה">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-5">
                <EntityFormFields fields={fields} values={values} onChange={handleChange} />

                {error && (
                  <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>
                    ביטול
                  </Button>
                  <Button type="submit" loading={saving}>
                    <Save className="h-4 w-4" />
                    שמור שינויים
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : (
          <>
            {stats && stats.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label}>
                    <CardBody className="p-5">
                      <p className="text-sm text-secondary-500">{stat.label}</p>
                      <p
                        className={cn(
                          'text-2xl font-extrabold mt-1 tabular-nums break-words',
                          STAT_TONES[stat.tone ?? 'neutral']
                        )}
                      >
                        {stat.value}
                      </p>
                      {stat.hint && <p className="text-xs text-secondary-400 mt-1">{stat.hint}</p>}
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>פרטי {entityName}</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  {fields.map((field) => (
                    <div
                      key={field.name}
                      className={cn(
                        'py-3 border-b border-secondary-100',
                        field.fullWidth && 'sm:col-span-2'
                      )}
                    >
                      <dt className="text-xs font-medium text-secondary-400">
                        {field.label.replace(' *', '')}
                      </dt>
                      <dd className="mt-1 text-sm text-secondary-900 break-words">
                        {renderValue(field, record[field.name])}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap gap-x-6 gap-y-1 pt-4 text-xs text-secondary-400">
                  {typeof record.created_at === 'string' && (
                    <span>נוצר: {formatDateTime(record.created_at)}</span>
                  )}
                  {typeof record.updated_at === 'string' && (
                    <span>עודכן: {formatDateTime(record.updated_at)}</span>
                  )}
                </div>
              </CardBody>
            </Card>

            {extra}
          </>
        )}
      </div>
    </MainLayout>
  );
}

export function DetailSkeleton() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-secondary-100" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-secondary-100" />
            <div className="h-3.5 w-32 rounded bg-secondary-50" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-secondary-100" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-secondary-100" />
      </div>
    </MainLayout>
  );
}

export function DetailError({
  message,
  backHref,
  onRetry,
}: {
  message: string;
  backHref: string;
  onRetry?: () => void;
}) {
  return (
    <MainLayout>
      <Card>
        <CardBody className="p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
          <p className="mt-3 text-danger-600">{message}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href={backHref} className={secondaryLinkClasses}>
              <ArrowRight className="h-4 w-4" />
              חזרה לרשימה
            </Link>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                נסה שוב
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </MainLayout>
  );
}
