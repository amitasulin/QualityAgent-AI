'use client';

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Hash,
  MapPin,
  Package,
  Plus,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  incoming: 'בדיקת קבלה',
  in_process: 'בדיקת תהליך',
  final: 'בדיקה סופית',
  audit: 'ביקורת',
};

const RESULT_LABELS: Record<string, string> = {
  pass: 'עבר',
  fail: 'נכשל',
  na: 'לא רלוונטי',
};

const STATUS_STYLES: Record<
  string,
  {
    accent: string;
    iconBg: string;
    iconColor: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  passed: { accent: 'bg-success-500', iconBg: 'bg-success-50', iconColor: 'text-success-600', icon: CheckCircle2, label: 'הבדיקה עברה בהצלחה' },
  failed: { accent: 'bg-danger-500', iconBg: 'bg-danger-50', iconColor: 'text-danger-600', icon: XCircle, label: 'נמצאו ממצאים חורגים' },
  in_progress: { accent: 'bg-primary-500', iconBg: 'bg-primary-50', iconColor: 'text-primary-600', icon: ClipboardCheck, label: 'הבדיקה בעיצומה' },
  planned: { accent: 'bg-secondary-300', iconBg: 'bg-secondary-100', iconColor: 'text-secondary-500', icon: CalendarClock, label: 'הבדיקה מתוכננת' },
  on_hold: { accent: 'bg-warning-500', iconBg: 'bg-warning-50', iconColor: 'text-warning-600', icon: AlertTriangle, label: 'הבדיקה בהמתנה' },
};

interface InspectionResult {
  id: string;
  characteristic: string;
  nominal?: string | null;
  tolerance_plus?: string | null;
  tolerance_minus?: string | null;
  measured_value?: string | null;
  unit?: string | null;
  result: string;
  notes?: string | null;
}

interface Inspection {
  id: string;
  number: string;
  inspection_type: string;
  status: string;
  lot_number?: string | null;
  sample_size: number;
  passed_count: number;
  failed_count: number;
  pass_rate?: number | null;
  inspected_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  ncr_id?: string | null;
  created_at: string;
  plan?: { id: string; code: string; name: string } | null;
  product?: { id: string; sku: string; name: string } | null;
  site?: { id: string; name: string; code?: string | null } | null;
  inspector?: { id: string; full_name: string } | null;
  results: InspectionResult[];
}

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
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: 'success' | 'danger' | 'neutral' | 'primary';
}) {
  const valueTone = {
    success: 'text-success-600',
    danger: 'text-danger-600',
    neutral: 'text-secondary-900',
    primary: 'text-primary-600',
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
  value?: string | number | null;
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

function formatNumber(value?: string | null) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : String(num);
}

function toleranceText(result: InspectionResult) {
  const plus = formatNumber(result.tolerance_plus);
  const minus = formatNumber(result.tolerance_minus);
  if (!plus && !minus) return null;
  if (plus && minus && plus === minus) return `±${plus}`;
  return `+${plus ?? 0} / −${minus ?? 0}`;
}

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddResult, setShowAddResult] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdNcr, setCreatedNcr] = useState(false);

  const fetchInspection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getInspection(params.id);
      setInspection(data);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הבדיקה');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  const handleComplete = async () => {
    if (!inspection) return;
    if (!confirm('להשלים את הבדיקה? לא ניתן יהיה להוסיף תוצאות לאחר מכן.')) return;
    setCompleting(true);
    setActionError(null);
    try {
      const hadFailures = inspection.failed_count > 0;
      const updated = await api.completeInspection(inspection.id);
      setInspection(updated);
      setCreatedNcr(hadFailures && !!updated.ncr_id);
    } catch (err: unknown) {
      console.error(err);
      const detail = (err as { response?: { data?: { error?: { message?: string }; detail?: string } } })?.response?.data;
      setActionError(detail?.error?.message || detail?.detail || 'שגיאה בהשלמת הבדיקה');
    } finally {
      setCompleting(false);
    }
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!inspection) return;
    if (!confirm('למחוק את התוצאה?')) return;
    try {
      const updated = await api.deleteInspectionResult(inspection.id, resultId);
      setInspection(updated);
    } catch (err) {
      console.error(err);
      setActionError('שגיאה במחיקת התוצאה');
    }
  };

  const finished = inspection ? ['passed', 'failed'].includes(inspection.status) : false;
  const statusStyle = inspection ? STATUS_STYLES[inspection.status] || STATUS_STYLES.planned : STATUS_STYLES.planned;
  const StatusIcon = statusStyle.icon;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/inspections"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת הבדיקות
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
        ) : error || !inspection ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'הבדיקה לא נמצאה'}</p>
              <Link href="/inspections">
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
              <div className={cn('h-1.5 w-full', statusStyle.accent)} />
              <CardBody className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', statusStyle.iconBg)}>
                      <StatusIcon className={cn('h-7 w-7', statusStyle.iconColor)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-secondary-500">{inspection.number}</span>
                        <StatusBadge status={inspection.status} type="inspection" />
                        <Badge variant="secondary">{TYPE_LABELS[inspection.inspection_type] || inspection.inspection_type}</Badge>
                        {inspection.pass_rate !== null && inspection.pass_rate !== undefined && (
                          <Badge
                            variant={
                              inspection.pass_rate >= 95 ? 'success' : inspection.pass_rate >= 80 ? 'warning' : 'danger'
                            }
                          >
                            {inspection.pass_rate}% עמידה
                          </Badge>
                        )}
                      </div>
                      <h1 className="text-2xl font-bold text-secondary-900 mt-2">
                        בדיקה {inspection.number}
                        {inspection.product ? ` — ${inspection.product.name}` : ''}
                      </h1>
                      <p className="text-sm text-secondary-500 mt-1">
                        {statusStyle.label} ·{' '}
                        {inspection.inspected_at
                          ? `בוצעה ב־${formatDateTime(inspection.inspected_at)}`
                          : `נוצרה ב־${formatDateTime(inspection.created_at)}`}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {inspection.product && (
                          <MetaChip icon={Package}>
                            {inspection.product.sku} · {inspection.product.name}
                          </MetaChip>
                        )}
                        {inspection.site && (
                          <MetaChip icon={MapPin}>{inspection.site.name}</MetaChip>
                        )}
                        {inspection.lot_number && (
                          <MetaChip icon={Hash}>אצווה {inspection.lot_number}</MetaChip>
                        )}
                        {inspection.plan && (
                          <MetaChip icon={ClipboardList}>{inspection.plan.code}</MetaChip>
                        )}
                        {inspection.inspector && (
                          <MetaChip icon={User}>{inspection.inspector.full_name}</MetaChip>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {!finished && (
                      <>
                        <Button variant="secondary" onClick={() => setShowAddResult(true)}>
                          <Plus className="h-4 w-4" />
                          הוסף תוצאה
                        </Button>
                        <Button
                          variant="success"
                          onClick={handleComplete}
                          loading={completing}
                          disabled={inspection.results.length === 0}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          השלם בדיקה
                        </Button>
                      </>
                    )}
                    {finished && inspection.ncr_id && (
                      <Link href={`/nonconformities/${inspection.ncr_id}`}>
                        <Button variant="danger">
                          <AlertTriangle className="h-4 w-4" />
                          צפייה באי-התאמה
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {actionError && (
                  <p className="mt-4 rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
                    {actionError}
                  </p>
                )}
                {createdNcr && inspection.ncr_id && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      הבדיקה הסתיימה עם ממצאים חורגים — נפתחה אוטומטית אי-התאמה.{' '}
                      <Link href={`/nonconformities/${inspection.ncr_id}`} className="underline font-medium">
                        מעבר לאי-התאמה
                      </Link>
                    </span>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Summary tiles */}
            <Card className="overflow-hidden">
              <CardBody className="p-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-secondary-100">
                  <StatTile label="עברו" value={inspection.passed_count} hint="תוצאות תקינות" tone="success" />
                  <StatTile label="נכשלו" value={inspection.failed_count} hint="ממצאים חורגים" tone="danger" />
                  <StatTile label="גודל מדגם" value={inspection.sample_size} hint="יחידות שנדגמו" tone="neutral" />
                  <StatTile
                    label="תוצאות שנרשמו"
                    value={inspection.results.length}
                    hint={finished ? 'הבדיקה הושלמה' : 'ניתן להוסיף עוד'}
                    tone="primary"
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-2 overflow-hidden">
                <CardHeader className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle>תוצאות הבדיקה</CardTitle>
                    <Badge variant="secondary">{inspection.results.length}</Badge>
                  </div>
                  {!finished && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAddResult(true)}>
                      <Plus className="h-4 w-4" />
                      הוסף
                    </Button>
                  )}
                </CardHeader>
                <CardBody className="p-0">
                  {inspection.results.length === 0 ? (
                    <div className="p-10 text-center">
                      <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center mx-auto">
                        <ClipboardList className="h-6 w-6 text-secondary-400" />
                      </div>
                      <h3 className="mt-3 font-semibold text-secondary-900">לא נרשמו תוצאות עדיין</h3>
                      <p className="text-sm text-secondary-500 mt-1">הוסף תוצאה ראשונה כדי להתחיל לתעד את הבדיקה</p>
                      {!finished && (
                        <Button className="mt-4" onClick={() => setShowAddResult(true)}>
                          <Plus className="h-4 w-4" />
                          הוסף תוצאה
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>מאפיין</TableHead>
                            <TableHead>נומינלי</TableHead>
                            <TableHead>סובלנות</TableHead>
                            <TableHead>ערך מדוד</TableHead>
                            <TableHead>תוצאה</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inspection.results.map((result) => (
                            <TableRow key={result.id} className="group">
                              <TableCell>
                                <div className="font-medium text-secondary-900">{result.characteristic}</div>
                                {result.notes && <div className="text-xs text-secondary-400 mt-0.5">{result.notes}</div>}
                              </TableCell>
                              <TableCell className="text-sm text-secondary-600 tabular-nums">
                                {formatNumber(result.nominal) ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-secondary-500 tabular-nums">
                                {toleranceText(result) ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-secondary-900 tabular-nums">
                                {result.measured_value
                                  ? `${formatNumber(result.measured_value)} ${result.unit || ''}`.trim()
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                    result.result === 'pass'
                                      ? 'bg-success-50 text-success-600'
                                      : result.result === 'fail'
                                        ? 'bg-danger-50 text-danger-600'
                                        : 'bg-secondary-100 text-secondary-600'
                                  )}
                                >
                                  {result.result === 'pass' ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : result.result === 'fail' ? (
                                    <XCircle className="h-3.5 w-3.5" />
                                  ) : null}
                                  {RESULT_LABELS[result.result] || result.result}
                                </span>
                              </TableCell>
                              <TableCell>
                                {!finished && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteResult(result.id)}
                                    aria-label="מחק תוצאה"
                                  >
                                    <Trash2 className="h-4 w-4 text-danger-500" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>פרטי הבדיקה</CardTitle>
                </CardHeader>
                <CardBody className="pt-2">
                  <dl className="divide-y divide-secondary-100">
                    <DetailRow
                      icon={Package}
                      label="מוצר"
                      value={inspection.product ? `${inspection.product.sku} · ${inspection.product.name}` : null}
                    />
                    <DetailRow icon={MapPin} label="אתר / קו" value={inspection.site?.name} />
                    <DetailRow icon={Hash} label="אצווה" value={inspection.lot_number} />
                    <DetailRow
                      icon={ClipboardList}
                      label="תוכנית בדיקה"
                      value={inspection.plan ? `${inspection.plan.code} · ${inspection.plan.name}` : null}
                    />
                    <DetailRow icon={User} label="מבצע הבדיקה" value={inspection.inspector?.full_name} />
                    <DetailRow
                      icon={CalendarClock}
                      label="הושלמה ב־"
                      value={inspection.completed_at ? formatDate(inspection.completed_at) : null}
                    />
                  </dl>

                  {inspection.notes && (
                    <div className="mt-4 rounded-lg bg-secondary-50 border border-secondary-100 p-3">
                      <p className="text-xs font-medium text-secondary-400 mb-1">הערות</p>
                      <p className="text-sm text-secondary-700 whitespace-pre-wrap">{inspection.notes}</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>

      {inspection && (
        <AddResultModal
          isOpen={showAddResult}
          onClose={() => setShowAddResult(false)}
          inspectionId={inspection.id}
          onAdded={async () => {
            setShowAddResult(false);
            await fetchInspection();
          }}
        />
      )}
    </MainLayout>
  );
}

function AddResultModal({
  isOpen,
  onClose,
  inspectionId,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  inspectionId: string;
  onAdded: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    characteristic: '',
    result: 'pass',
    nominal: '',
    tolerance_plus: '',
    tolerance_minus: '',
    measured_value: '',
    unit: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setForm({
        characteristic: '',
        result: 'pass',
        nominal: '',
        tolerance_plus: '',
        tolerance_minus: '',
        measured_value: '',
        unit: '',
        notes: '',
      });
      setError(null);
    }
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.addInspectionResult(inspectionId, {
        characteristic: form.characteristic,
        result: form.result,
        nominal: form.nominal === '' ? null : Number(form.nominal),
        tolerance_plus: form.tolerance_plus === '' ? null : Number(form.tolerance_plus),
        tolerance_minus: form.tolerance_minus === '' ? null : Number(form.tolerance_minus),
        measured_value: form.measured_value === '' ? null : Number(form.measured_value),
        unit: form.unit || null,
        notes: form.notes || null,
      });
      await onAdded();
    } catch (err) {
      console.error(err);
      setError('שגיאה בהוספת התוצאה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="הוספת תוצאת בדיקה" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="מאפיין נבדק *"
            value={form.characteristic}
            onChange={(e) => setForm((p) => ({ ...p, characteristic: e.target.value }))}
            placeholder="משקל, אורך, אטימות..."
            required
          />
          <Select
            label="תוצאה *"
            value={form.result}
            onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
            options={Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label }))}
            required
          />
        </div>

        <div className="rounded-xl border border-secondary-200 p-4">
          <p className="text-sm font-medium text-secondary-700 mb-3">מדידה וסובלנות</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="נומינלי"
              type="number"
              step="any"
              value={form.nominal}
              onChange={(e) => setForm((p) => ({ ...p, nominal: e.target.value }))}
            />
            <Input
              label="סובלנות +"
              type="number"
              step="any"
              value={form.tolerance_plus}
              onChange={(e) => setForm((p) => ({ ...p, tolerance_plus: e.target.value }))}
            />
            <Input
              label="סובלנות −"
              type="number"
              step="any"
              value={form.tolerance_minus}
              onChange={(e) => setForm((p) => ({ ...p, tolerance_minus: e.target.value }))}
            />
            <Input
              label="יחידה"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              placeholder='מ"מ, גר'
            />
          </div>
          <div className="mt-4">
            <Input
              label="ערך מדוד"
              type="number"
              step="any"
              value={form.measured_value}
              onChange={(e) => setForm((p) => ({ ...p, measured_value: e.target.value }))}
            />
          </div>
        </div>

        <Textarea
          label="הערות"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button type="submit" loading={saving}>
            הוסף תוצאה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
