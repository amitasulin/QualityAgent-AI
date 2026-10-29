'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  CalendarClock,
  FileText,
  Hash,
  Paperclip,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NCR {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  lot_number?: string | null;
  serial_number?: string | null;
  defect_code?: string | null;
  defect_description?: string | null;
  measured_value?: string | null;
  unit?: string | null;
  detected_at: string;
  contained_at?: string | null;
  containment_action?: string | null;
  root_cause?: string | null;
  root_cause_analysis_method?: string | null;
  closed_at?: string | null;
  closure_notes?: string | null;
  attachments?: Array<{ id: string; file_name: string; file_size?: number | null }>;
}

const STATUS_ACCENT: Record<string, string> = {
  draft: 'bg-secondary-300',
  open: 'bg-primary-500',
  contained: 'bg-warning-500',
  investigating: 'bg-primary-500',
  action_pending: 'bg-warning-500',
  effectiveness_review: 'bg-primary-500',
  closed: 'bg-success-500',
  reopened: 'bg-danger-500',
};

function MetaChip({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary-200 bg-white px-3 py-1 text-xs text-secondary-600">
      <Icon className="h-3.5 w-3.5 text-secondary-400" />
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'success' | 'danger' | 'neutral' | 'primary' | 'warning';
}) {
  const valueTone = {
    success: 'text-success-600',
    danger: 'text-danger-600',
    neutral: 'text-secondary-900',
    primary: 'text-primary-600',
    warning: 'text-warning-600',
  }[tone];
  return (
    <div className="p-5 bg-white">
      <p className="text-sm text-secondary-500">{label}</p>
      <p className={cn('text-2xl font-extrabold mt-1 tabular-nums', valueTone)}>{value}</p>
      {hint && <p className="text-xs text-secondary-400 mt-1">{hint}</p>}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-secondary-50 border border-secondary-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-secondary-400" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-secondary-400">{label}</dt>
        <dd className="text-sm text-secondary-900 mt-0.5 break-words">{value ?? '—'}</dd>
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  children,
  tone = 'secondary',
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  tone?: 'primary' | 'warning' | 'success' | 'secondary';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    warning: 'bg-warning-50 text-warning-700 border-warning-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    secondary: 'bg-secondary-50 text-secondary-600 border-secondary-200',
  }[tone];

  return (
    <div className={cn('rounded-xl border p-4', tones)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="text-sm text-secondary-700 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function daysOpen(detectedAt: string, closedAt?: string | null) {
  const start = new Date(detectedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

export default function NCRDetailPage() {
  const params = useParams<{ id: string }>();
  const [ncr, setNcr] = useState<NCR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getNonconformity(params.id);
        if (!cancelled) setNcr(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת החריגה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const accent = ncr ? STATUS_ACCENT[ncr.status] || 'bg-secondary-300' : 'bg-secondary-300';
  const openDays = ncr ? daysOpen(ncr.detected_at, ncr.closed_at) : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/nonconformities"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת אי ההתאמות
        </Link>

        {loading ? (
          <Card>
            <CardBody className="p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-1/4 rounded bg-secondary-100" />
                <div className="h-8 w-1/2 rounded bg-secondary-100" />
                <div className="h-4 w-1/3 rounded bg-secondary-50" />
              </div>
            </CardBody>
          </Card>
        ) : error || !ncr ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'החריגה לא נמצאה'}</p>
              <Link href="/nonconformities">
                <Button variant="secondary" className="mt-4">
                  חזרה לרשימה
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Hero */}
            <Card className="overflow-hidden">
              <div className={cn('h-1.5 w-full', accent)} />
              <CardBody className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-danger-500 to-danger-600 shadow-lg shadow-danger-500/25 flex items-center justify-center shrink-0">
                      <ShieldAlert className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-secondary-500">{ncr.number}</span>
                        <StatusBadge status={ncr.status} type="ncr" />
                        <SeverityBadge severity={ncr.severity} />
                      </div>
                      <h1 className="text-2xl font-bold text-secondary-900 mt-2">{ncr.title}</h1>
                      <p className="text-sm text-secondary-500 mt-1">
                        זוהה ב־{formatDateTime(ncr.detected_at)}
                        {ncr.closed_at ? ` · נסגר ב־${formatDateTime(ncr.closed_at)}` : ` · פתוח ${openDays} ימים`}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {ncr.lot_number && <MetaChip icon={Hash}>אצווה {ncr.lot_number}</MetaChip>}
                        {ncr.serial_number && <MetaChip icon={Barcode}>סידורי {ncr.serial_number}</MetaChip>}
                        {ncr.defect_code && <MetaChip icon={AlertTriangle}>פגם {ncr.defect_code}</MetaChip>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link href="/corrective-actions">
                      <Button variant="secondary">
                        <Wrench className="h-4 w-4" />
                        פעולות מתקנות
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Summary tiles */}
            <Card className="overflow-hidden">
              <CardBody className="p-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-secondary-100">
                  <StatTile label="חומרה" value={<SeverityBadge severity={ncr.severity} />} hint="דירוג סיכון" tone="neutral" />
                  <StatTile label="סטטוס" value={<StatusBadge status={ncr.status} type="ncr" />} hint="מצב הטיפול" tone="neutral" />
                  <StatTile
                    label="ימים פתוח"
                    value={openDays}
                    hint={ncr.closed_at ? 'נסגר' : 'מאז הזיהוי'}
                    tone={openDays > 7 && !ncr.closed_at ? 'danger' : 'primary'}
                  />
                  <StatTile
                    label="קבצים מצורפים"
                    value={ncr.attachments?.length ?? 0}
                    hint="ראיות ותיעוד"
                    tone="neutral"
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <CardTitle>תיאור החריגה</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">
                      {ncr.description || '—'}
                    </p>
                  </CardBody>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-warning-500" />
                      <CardTitle>בלימה (Containment)</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {ncr.containment_action || ncr.contained_at ? (
                        <div className="space-y-3">
                          {ncr.contained_at && (
                            <p className="text-xs text-secondary-400">
                              בוצע ב־{formatDateTime(ncr.contained_at)}
                            </p>
                          )}
                          <InfoBlock icon={ShieldCheck} title="פעולת בלימה" tone="warning">
                            {ncr.containment_action || '—'}
                          </InfoBlock>
                        </div>
                      ) : (
                        <p className="text-sm text-secondary-500">לא תועדה פעולת בלימה</p>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-primary-600" />
                      <CardTitle>ניתוח שורש וסגירה</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <InfoBlock icon={Wrench} title="סיבת שורש" tone="primary">
                          {ncr.root_cause || 'לא בוצע ניתוח שורש'}
                        </InfoBlock>
                        {ncr.root_cause_analysis_method && (
                          <p className="text-xs text-secondary-500">
                            שיטת ניתוח: {ncr.root_cause_analysis_method}
                          </p>
                        )}
                        {ncr.closure_notes && (
                          <InfoBlock icon={ShieldCheck} title="הערות סגירה" tone="success">
                            {ncr.closure_notes}
                          </InfoBlock>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-secondary-500" />
                    <CardTitle>קבצים מצורפים</CardTitle>
                    <Badge variant="secondary">{ncr.attachments?.length ?? 0}</Badge>
                  </CardHeader>
                  <CardBody className={ncr.attachments?.length ? 'pt-2' : undefined}>
                    {ncr.attachments && ncr.attachments.length > 0 ? (
                      <ul className="divide-y divide-secondary-100">
                        {ncr.attachments.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                            <span className="inline-flex items-center gap-2 text-sm text-secondary-900">
                              <Paperclip className="h-4 w-4 text-secondary-400" />
                              {a.file_name}
                            </span>
                            <Badge variant="secondary">
                              {a.file_size ? `${Math.round(a.file_size / 1024)} KB` : '—'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-secondary-500">אין קבצים מצורפים</p>
                    )}
                  </CardBody>
                </Card>
              </div>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>פרטי החריגה</CardTitle>
                </CardHeader>
                <CardBody className="pt-2">
                  <dl className="divide-y divide-secondary-100">
                    <DetailRow icon={Hash} label="אצווה" value={ncr.lot_number} />
                    <DetailRow icon={Barcode} label="מספר סידורי" value={ncr.serial_number} />
                    <DetailRow icon={AlertTriangle} label="קוד פגם" value={ncr.defect_code} />
                    <DetailRow icon={FileText} label="תיאור פגם" value={ncr.defect_description} />
                    <DetailRow
                      icon={Ruler}
                      label="ערך מדוד"
                      value={
                        ncr.measured_value
                          ? `${Number(ncr.measured_value)} ${ncr.unit || ''}`.trim()
                          : null
                      }
                    />
                    <DetailRow
                      icon={CalendarClock}
                      label="נסגר ב־"
                      value={ncr.closed_at ? formatDateTime(ncr.closed_at) : null}
                    />
                  </dl>
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
