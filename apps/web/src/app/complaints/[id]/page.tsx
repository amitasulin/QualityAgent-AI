'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Hash,
  Link2,
  MessageSquareWarning,
  Package,
  Save,
  ShieldCheck,
  Star,
  User,
  Wrench,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';

interface Complaint {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  customer_reference?: string | null;
  lot_number?: string | null;
  received_at: string;
  due_date?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  resolution?: string | null;
  root_cause?: string | null;
  satisfaction_rating?: number | null;
  customer?: { id: string; code: string; name: string } | null;
  product?: { id: string; sku: string; name: string } | null;
  assigned_to?: { id: string; full_name: string } | null;
  ncr?: { id: string; number: string; title: string; status: string } | null;
}

const STATUS_ACCENT: Record<string, string> = {
  new: 'bg-primary-500',
  under_review: 'bg-primary-400',
  investigating: 'bg-warning-500',
  action_pending: 'bg-warning-400',
  resolved: 'bg-success-500',
  closed: 'bg-success-600',
  rejected: 'bg-secondary-400',
};

const statusOptions = [
  { value: 'new', label: 'חדשה' },
  { value: 'under_review', label: 'בבדיקה' },
  { value: 'investigating', label: 'בחקירה' },
  { value: 'action_pending', label: 'ממתין לפעולה' },
  { value: 'resolved', label: 'טופלה' },
  { value: 'closed', label: 'סגורה' },
  { value: 'rejected', label: 'נדחתה' },
];

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

function daysBetween(start: string, end?: string | null) {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingNcr, setCreatingNcr] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [rating, setRating] = useState('');

  const applyComplaint = (data: Complaint) => {
    setComplaint(data);
    setStatus(data.status);
    setResolution(data.resolution || '');
    setRootCause(data.root_cause || '');
    setRating(data.satisfaction_rating ? String(data.satisfaction_rating) : '');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getComplaint(params.id);
        if (!cancelled) {
          applyComplaint(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת התלונה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const saveStatus = async () => {
    if (!complaint || status === complaint.status) return;
    setSaving(true);
    setActionError(null);
    try {
      applyComplaint(await api.updateComplaint(complaint.id, { status }));
    } catch (err) {
      console.error(err);
      setActionError('שגיאה בעדכון הסטטוס');
    } finally {
      setSaving(false);
    }
  };

  const saveTreatment = async () => {
    if (!complaint) return;
    setSaving(true);
    setActionError(null);
    try {
      const payload: Record<string, unknown> = { resolution, root_cause: rootCause };
      if (rating) payload.satisfaction_rating = Number(rating);
      applyComplaint(await api.updateComplaint(complaint.id, payload));
    } catch (err) {
      console.error(err);
      setActionError('שגיאה בשמירת הטיפול');
    } finally {
      setSaving(false);
    }
  };

  const createNcr = async () => {
    if (!complaint) return;
    setCreatingNcr(true);
    setActionError(null);
    try {
      applyComplaint(await api.createNcrFromComplaint(complaint.id));
    } catch (err) {
      console.error(err);
      setActionError('שגיאה ביצירת אי-התאמה');
    } finally {
      setCreatingNcr(false);
    }
  };

  const accent = complaint ? STATUS_ACCENT[complaint.status] || 'bg-secondary-300' : 'bg-secondary-300';
  const openDays = complaint ? daysBetween(complaint.received_at, complaint.closed_at || complaint.resolved_at) : 0;
  const isClosed = complaint ? ['resolved', 'closed', 'rejected'].includes(complaint.status) : false;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/complaints"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת התלונות
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
        ) : error || !complaint ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'התלונה לא נמצאה'}</p>
              <Link href="/complaints">
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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 shadow-lg shadow-warning-500/25 flex items-center justify-center shrink-0">
                      <MessageSquareWarning className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-secondary-500">{complaint.number}</span>
                        <StatusBadge status={complaint.status} type="complaint" />
                        <SeverityBadge severity={complaint.severity} />
                      </div>
                      <h1 className="text-2xl font-bold text-secondary-900 mt-2">{complaint.title}</h1>
                      <p className="text-sm text-secondary-500 mt-1">
                        התקבלה ב־{formatDateTime(complaint.received_at)}
                        {complaint.closed_at
                          ? ` · נסגרה ב־${formatDateTime(complaint.closed_at)}`
                          : ` · פתוחה ${openDays} ימים`}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {complaint.customer && (
                          <MetaChip icon={Building2}>{complaint.customer.name}</MetaChip>
                        )}
                        {complaint.product && (
                          <MetaChip icon={Package}>
                            {complaint.product.sku} · {complaint.product.name}
                          </MetaChip>
                        )}
                        {complaint.lot_number && <MetaChip icon={Hash}>אצווה {complaint.lot_number}</MetaChip>}
                        {complaint.customer_reference && (
                          <MetaChip icon={FileText}>אסמכתא {complaint.customer_reference}</MetaChip>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {complaint.ncr ? (
                      <Link href={`/nonconformities/${complaint.ncr.id}`}>
                        <Button variant="secondary">
                          <Link2 className="h-4 w-4" />
                          {complaint.ncr.number}
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="secondary" onClick={createNcr} loading={creatingNcr}>
                        {!creatingNcr && <Wrench className="h-4 w-4" />}
                        פתח אי-התאמה
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Summary tiles */}
            <Card className="overflow-hidden">
              <CardBody className="p-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-secondary-100">
                  <StatTile label="חומרה" value={<SeverityBadge severity={complaint.severity} />} hint="דירוג סיכון" />
                  <StatTile label="סטטוס" value={<StatusBadge status={complaint.status} type="complaint" />} hint="מצב הטיפול" />
                  <StatTile
                    label="ימים מאז הקליטה"
                    value={openDays}
                    hint={isClosed ? 'התלונה טופלה' : 'עד לסגירה'}
                    tone={!isClosed && openDays > 14 ? 'danger' : 'primary'}
                  />
                  <StatTile
                    label="שביעות רצון"
                    value={
                      complaint.satisfaction_rating ? (
                        <span className="inline-flex items-center gap-1">
                          {complaint.satisfaction_rating}
                          <Star className="h-4 w-4 text-warning-500" />
                        </span>
                      ) : (
                        '—'
                      )
                    }
                    hint="דירוג הלקוח"
                    tone="warning"
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <CardTitle>תיאור התלונה</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">
                      {complaint.description || '—'}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-success-600" />
                    <CardTitle>טיפול ופתרון</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <Textarea
                      label="סיבת שורש"
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      rows={2}
                      placeholder="מה גרם לתלונה?"
                    />
                    <Textarea
                      label="פתרון ומענה ללקוח"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={3}
                      placeholder="כיצד טופלה התלונה ומה נמסר ללקוח"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <Select
                        label="דירוג שביעות רצון"
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                        options={[
                          { value: '1', label: '1 - לא מרוצה' },
                          { value: '2', label: '2 - מעט מרוצה' },
                          { value: '3', label: '3 - בינוני' },
                          { value: '4', label: '4 - מרוצה' },
                          { value: '5', label: '5 - מרוצה מאוד' },
                        ]}
                        placeholder="לא דורג"
                        className="w-full sm:w-56"
                      />
                      <Button onClick={saveTreatment} loading={saving} className="sm:mb-0">
                        {!saving && <Save className="h-4 w-4" />}
                        שמור טיפול
                      </Button>
                    </div>
                    {actionError && (
                      <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
                        {actionError}
                      </p>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-secondary-500" />
                    <CardTitle>קישור לאי-התאמה (NCR)</CardTitle>
                  </CardHeader>
                  <CardBody>
                    {complaint.ncr ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-secondary-200 bg-secondary-50 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-secondary-200 flex items-center justify-center shrink-0">
                            <Wrench className="h-5 w-5 text-secondary-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-secondary-900">{complaint.ncr.number}</p>
                            <p className="text-sm text-secondary-500 truncate">{complaint.ncr.title}</p>
                          </div>
                        </div>
                        <Link href={`/nonconformities/${complaint.ncr.id}`}>
                          <Button variant="secondary" size="sm">
                            פתח
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-secondary-500">
                          לא נפתחה אי-התאמה עבור תלונה זו. פתיחת NCR תאפשר ניתוח שורש ופעולות מתקנות.
                        </p>
                        <Button variant="secondary" onClick={createNcr} loading={creatingNcr}>
                          {!creatingNcr && <Wrench className="h-4 w-4" />}
                          פתח NCR
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>עדכון סטטוס</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      options={statusOptions}
                    />
                    <Button
                      className="w-full"
                      onClick={saveStatus}
                      loading={saving}
                      disabled={status === complaint.status}
                    >
                      {!saving && <CheckCircle2 className="h-4 w-4" />}
                      עדכן סטטוס
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-secondary-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      יעד SLA:{' '}
                      {complaint.due_date ? formatDateTime(complaint.due_date) : 'לא הוגדר'}
                    </div>
                  </CardBody>
                </Card>

                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>פרטי התלונה</CardTitle>
                  </CardHeader>
                  <CardBody className="pt-2">
                    <dl className="divide-y divide-secondary-100">
                      <DetailRow icon={Building2} label="לקוח" value={complaint.customer ? `${complaint.customer.code} · ${complaint.customer.name}` : null} />
                      <DetailRow icon={Package} label="מוצר" value={complaint.product ? `${complaint.product.sku} · ${complaint.product.name}` : null} />
                      <DetailRow icon={Hash} label="אצווה" value={complaint.lot_number} />
                      <DetailRow icon={FileText} label="אסמכתת לקוח" value={complaint.customer_reference} />
                      <DetailRow icon={User} label="אחראי טיפול" value={complaint.assigned_to?.full_name} />
                      <DetailRow icon={CalendarClock} label="התקבלה" value={formatDateTime(complaint.received_at)} />
                      <DetailRow icon={Clock3} label="אושרה לקליטה" value={complaint.acknowledged_at ? formatDateTime(complaint.acknowledged_at) : null} />
                      <DetailRow icon={CheckCircle2} label="טופלה" value={complaint.resolved_at ? formatDateTime(complaint.resolved_at) : null} />
                      <DetailRow icon={ShieldCheck} label="נסגרה" value={complaint.closed_at ? formatDateTime(complaint.closed_at) : null} />
                    </dl>
                  </CardBody>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
