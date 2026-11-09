'use client';

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Link2,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Timer,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { hasAnyRole, INSPECTOR_ROLES, usePermissions } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CAPA {
  id: string;
  ncr_id: string;
  title: string;
  description: string;
  action_type: string;
  status: string;
  owner_id?: string | null;
  due_date: string;
  started_at?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  effectiveness_check_date?: string | null;
  effectiveness_result?: boolean | null;
  effectiveness_evidence?: string | null;
}

const actionTypeLabels: Record<string, string> = {
  correction: 'תיקון',
  corrective_action: 'פעולה מתקנת',
  preventive_action: 'פעולה מונעת',
};

const ACTION_TYPE_OPTIONS = [
  { value: 'correction', label: 'תיקון' },
  { value: 'corrective_action', label: 'פעולה מתקנת' },
  { value: 'preventive_action', label: 'פעולה מונעת' },
];

const STATUS_ACCENT: Record<string, string> = {
  draft: 'bg-secondary-300',
  assigned: 'bg-primary-500',
  in_progress: 'bg-primary-500',
  pending_review: 'bg-warning-500',
  effectiveness_check: 'bg-primary-500',
  completed: 'bg-success-500',
  rejected: 'bg-danger-500',
};

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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

function TimelineItem({
  icon: Icon,
  label,
  value,
  last,
  done,
  fallback,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  last?: boolean;
  done?: boolean;
  fallback?: string;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute right-[15px] top-8 bottom-0 w-px bg-secondary-200" />}
      <span
        className={cn(
          'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
          done
            ? 'bg-success-50 border-success-200 text-success-600'
            : 'bg-white border-secondary-200 text-secondary-400'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-secondary-900">{label}</p>
        <p className="text-xs text-secondary-400 mt-0.5">
          {value ? formatDateTime(value) : done && fallback ? fallback : 'טרם בוצע'}
        </p>
      </div>
    </li>
  );
}

function daysUntil(dueDate: string) {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CAPADetailPage() {
  const params = useParams<{ id: string }>();
  const { user, role, isManager } = usePermissions();
  const [capa, setCapa] = useState<CAPA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ verification_notes: '', effectiveness_check_date: '' });
  const [effectivenessOpen, setEffectivenessOpen] = useState(false);
  const [effectivenessForm, setEffectivenessForm] = useState({
    check_date: todayISO(),
    result: 'true',
    evidence: '',
    notes: '',
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    action_type: 'corrective_action',
    due_date: '',
    effectiveness_check_date: '',
  });

  const loadCapa = useCallback(async () => {
    const data = await api.getCorrectiveAction(params.id);
    setCapa(data);
    return data as CAPA;
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getCorrectiveAction(params.id);
        if (!cancelled) setCapa(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת הפעולה המתקנת');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const canStart = Boolean(user);
  const canComplete = hasAnyRole(role, INSPECTOR_ROLES);
  const canVerify = isManager;
  const canEffectiveness = hasAnyRole(role, INSPECTOR_ROLES);
  const canEdit = Boolean(capa) && (
    isManager ||
    (role === 'quality_inspector' && ['draft', 'assigned'].includes(capa?.status ?? '')) ||
    (Boolean(user) && capa?.owner_id === user?.id && ['assigned', 'in_progress'].includes(capa?.status ?? ''))
  );

  const openEdit = () => {
    if (!capa) return;
    setEditForm({
      title: capa.title || '',
      description: capa.description || '',
      action_type: capa.action_type || 'corrective_action',
      due_date: capa.due_date ? capa.due_date.slice(0, 10) : '',
      effectiveness_check_date: capa.effectiveness_check_date
        ? capa.effectiveness_check_date.slice(0, 10)
        : '',
    });
    setEditOpen(true);
  };

  const handleStart = async () => {
    if (!capa) return;
    setActing(true);
    try {
      const updated = await api.startCorrectiveAction(capa.id);
      setCapa(updated);
      toast.success('הביצוע החל — בהצלחה');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'התחלת הביצוע נכשלה'));
    } finally {
      setActing(false);
    }
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capa) return;
    setActing(true);
    try {
      const updated = await api.completeCorrectiveAction(
        capa.id,
        completeNotes.trim() || undefined
      );
      setCapa(updated);
      setCompleteOpen(false);
      setCompleteNotes('');
      toast.success('הפעולה הושלמה וממתינה לאימות');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'סיום הפעולה נכשל'));
    } finally {
      setActing(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capa) return;
    if (!verifyForm.verification_notes.trim()) {
      toast.error('יש להזין הערות אימות');
      return;
    }
    setActing(true);
    try {
      const updated = await api.verifyCorrectiveAction(
        capa.id,
        verifyForm.verification_notes.trim(),
        verifyForm.effectiveness_check_date || undefined
      );
      setCapa(updated);
      setVerifyOpen(false);
      setVerifyForm({ verification_notes: '', effectiveness_check_date: '' });
      toast.success('הפעולה אומתה ועברה לבדיקת אפקטיביות');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'אימות הפעולה נכשל'));
    } finally {
      setActing(false);
    }
  };

  const handleEffectiveness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capa) return;
    setActing(true);
    try {
      await api.createEffectivenessCheck(capa.id, {
        check_date: effectivenessForm.check_date,
        result: effectivenessForm.result === 'true',
        evidence: effectivenessForm.evidence.trim() || null,
        notes: effectivenessForm.notes.trim() || null,
      });
      await loadCapa();
      setEffectivenessOpen(false);
      setEffectivenessForm({
        check_date: todayISO(),
        result: 'true',
        evidence: '',
        notes: '',
      });
      toast.success('בדיקת האפקטיביות נרשמה');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'רישום בדיקת האפקטיביות נכשל'));
    } finally {
      setActing(false);
    }
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capa) return;
    setActing(true);
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        action_type: editForm.action_type,
        due_date: editForm.due_date,
        effectiveness_check_date: editForm.effectiveness_check_date || null,
      };
      const updated = await api.updateCorrectiveAction(capa.id, payload);
      setCapa(updated);
      setEditOpen(false);
      toast.success('הפעולה המתקנת עודכנה בהצלחה');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון הפעולה המתקנת נכשל'));
    } finally {
      setActing(false);
    }
  };

  const accent = capa ? STATUS_ACCENT[capa.status] || 'bg-secondary-300' : 'bg-secondary-300';
  const finished = capa ? ['completed', 'rejected'].includes(capa.status) : false;
  const remaining = capa ? daysUntil(capa.due_date) : 0;
  const isOverdue = !finished && remaining < 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/corrective-actions"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לפעולות מתקנות
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
        ) : error || !capa ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'הפעולה לא נמצאה'}</p>
              <Link href="/corrective-actions">
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
                      <ShieldCheck className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={capa.status} type="capa" />
                        <Badge variant="secondary">
                          {actionTypeLabels[capa.action_type] || capa.action_type}
                        </Badge>
                      </div>
                      <h1 className="text-2xl font-bold text-secondary-900 mt-2">{capa.title}</h1>
                      <p className="text-sm text-secondary-500 mt-1">
                        תאריך יעד {formatDate(capa.due_date)}
                        {isOverdue
                          ? ` · באיחור ${Math.abs(remaining)} ימים`
                          : !finished
                            ? ` · ${remaining === 0 ? 'היום' : `${remaining} ימים נותרו`}`
                            : ' · הושלמה'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {['draft', 'assigned'].includes(capa.status) && canStart && (
                      <Button onClick={handleStart} loading={acting}>
                        <PlayCircle className="h-4 w-4" />
                        התחל ביצוע
                      </Button>
                    )}
                    {capa.status === 'in_progress' && canComplete && (
                      <Button onClick={() => setCompleteOpen(true)}>
                        <CheckCircle2 className="h-4 w-4" />
                        סיים ביצוע
                      </Button>
                    )}
                    {capa.status === 'pending_review' && canVerify && (
                      <Button
                        onClick={() => {
                          setVerifyForm({
                            verification_notes: capa.verification_notes || '',
                            effectiveness_check_date: '',
                          });
                          setVerifyOpen(true);
                        }}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        אמת פעולה
                      </Button>
                    )}
                    {capa.status === 'effectiveness_check' && canEffectiveness && (
                      <Button
                        onClick={() => {
                          setEffectivenessForm({
                            check_date: todayISO(),
                            result: 'true',
                            evidence: '',
                            notes: '',
                          });
                          setEffectivenessOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        בדיקת אפקטיביות
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="secondary" onClick={openEdit}>
                        <Pencil className="h-4 w-4" />
                        עריכה
                      </Button>
                    )}
                    <Link href={`/nonconformities/${capa.ncr_id}`}>
                      <Button variant="secondary">
                        <Link2 className="h-4 w-4" />
                        לחריגה המקורית
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
                  <StatTile label="סטטוס" value={<StatusBadge status={capa.status} type="capa" />} hint="מצב הפעולה" />
                  <StatTile
                    label="נותרו"
                    value={
                      finished ? '—' : remaining < 0 ? `${Math.abs(remaining)}−` : remaining
                    }
                    hint={finished ? 'הפעולה הסתיימה' : remaining < 0 ? 'ימי איחור' : 'ימים ליעד'}
                    tone={isOverdue ? 'danger' : 'primary'}
                  />
                  <StatTile
                    label="אפקטיביות"
                    value={
                      capa.effectiveness_result === null || capa.effectiveness_result === undefined ? (
                        <span className="text-base font-semibold text-secondary-500">טרם נבדקה</span>
                      ) : (
                        <Badge variant={capa.effectiveness_result ? 'success' : 'danger'}>
                          {capa.effectiveness_result ? 'אפקטיבית' : 'לא אפקטיבית'}
                        </Badge>
                      )
                    }
                    hint="בדיקת אפקטיביות"
                  />
                  <StatTile
                    label="אימות"
                    value={capa.verified_at ? 'בוצע' : 'ממתין'}
                    hint={capa.verified_at ? formatDate(capa.verified_at) : 'טרם אומתה'}
                    tone={capa.verified_at ? 'success' : 'neutral'}
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <CardTitle>תיאור הפעולה</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">
                      {capa.description || '—'}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary-600" />
                    <CardTitle>בדיקת אפקטיביות</CardTitle>
                    {capa.effectiveness_result !== null && capa.effectiveness_result !== undefined && (
                      <Badge variant={capa.effectiveness_result ? 'success' : 'danger'}>
                        {capa.effectiveness_result ? 'אפקטיבית' : 'לא אפקטיבית'}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3">
                      <CalendarClock className="h-4 w-4 text-secondary-400" />
                      <span className="text-sm text-secondary-600">
                        תאריך בדיקה:{' '}
                        <span className="font-medium text-secondary-900">
                          {capa.effectiveness_check_date
                            ? formatDate(capa.effectiveness_check_date)
                            : 'טרם נקבע'}
                        </span>
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-secondary-400 mb-1">ראיות</p>
                      <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                        {capa.effectiveness_evidence || '—'}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-secondary-500" />
                    <CardTitle>לוח זמנים</CardTitle>
                  </CardHeader>
                  <CardBody className="pt-4">
                    <ul>
                      <TimelineItem
                        icon={CalendarClock}
                        label="תאריך יעד"
                        value={capa.due_date}
                        done={!isOverdue}
                      />
                      <TimelineItem
                        icon={PlayCircle}
                        label="התחלה"
                        value={capa.started_at}
                        done={Boolean(capa.started_at)}
                      />
                      <TimelineItem
                        icon={CheckCircle2}
                        label="סיום"
                        value={capa.completed_at}
                        done={Boolean(capa.completed_at) || capa.status === 'completed'}
                        fallback="הושלם"
                      />
                      <TimelineItem
                        icon={ShieldCheck}
                        label="אימות"
                        value={capa.verified_at}
                        done={Boolean(capa.verified_at)}
                        last
                      />
                    </ul>
                  </CardBody>
                </Card>

                {capa.verification_notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>הערות אימות</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                        {capa.verification_notes}
                      </p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Complete modal */}
      <Modal
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="סיום ביצוע הפעולה"
        description="הפעולה תעבור לסטטוס ממתין לאימות."
        size="lg"
      >
        <form onSubmit={handleComplete} className="space-y-4">
          <Textarea
            label="הערות ביצוע"
            value={completeNotes}
            onChange={(event) => setCompleteNotes(event.target.value)}
            rows={4}
            placeholder="מה בוצע בפועל, מי ביצע ומתי, ומה התוצאה?"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCompleteOpen(false)} disabled={acting}>
              ביטול
            </Button>
            <Button type="submit" loading={acting}>
              <CheckCircle2 className="h-4 w-4" />
              סיים ביצוע
            </Button>
          </div>
        </form>
      </Modal>

      {/* Verify modal */}
      <Modal
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title="אימות הפעולה"
        description="האימות מעביר את הפעולה לבדיקת אפקטיביות."
        size="lg"
      >
        <form onSubmit={handleVerify} className="space-y-4">
          <Textarea
            label="הערות אימות *"
            value={verifyForm.verification_notes}
            onChange={(event) =>
              setVerifyForm((prev) => ({ ...prev, verification_notes: event.target.value }))
            }
            rows={4}
            required
            placeholder="כיצד אומתה ביצוע הפעולה? אילו ראיות נבדקו?"
          />
          <Input
            label="תאריך בדיקת אפקטיביות"
            type="date"
            value={verifyForm.effectiveness_check_date}
            onChange={(event) =>
              setVerifyForm((prev) => ({ ...prev, effectiveness_check_date: event.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setVerifyOpen(false)} disabled={acting}>
              ביטול
            </Button>
            <Button type="submit" loading={acting}>
              <ShieldCheck className="h-4 w-4" />
              אמת פעולה
            </Button>
          </div>
        </form>
      </Modal>

      {/* Effectiveness modal */}
      <Modal
        isOpen={effectivenessOpen}
        onClose={() => setEffectivenessOpen(false)}
        title="בדיקת אפקטיביות"
        description="פעולה אפקטיבית תסגור את ה-CAPA; פעולה לא אפקטיבית תדחה אותה לבדיקה חוזרת."
        size="lg"
      >
        <form onSubmit={handleEffectiveness} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="תאריך בדיקה *"
              type="date"
              value={effectivenessForm.check_date}
              onChange={(event) =>
                setEffectivenessForm((prev) => ({ ...prev, check_date: event.target.value }))
              }
              required
            />
            <Select
              label="תוצאה *"
              value={effectivenessForm.result}
              onChange={(event) =>
                setEffectivenessForm((prev) => ({ ...prev, result: event.target.value }))
              }
              options={[
                { value: 'true', label: 'אפקטיבית — הבעיה לא חזרה' },
                { value: 'false', label: 'לא אפקטיבית — נדרשת פעולה נוספת' },
              ]}
            />
          </div>
          <Textarea
            label="ראיות"
            value={effectivenessForm.evidence}
            onChange={(event) =>
              setEffectivenessForm((prev) => ({ ...prev, evidence: event.target.value }))
            }
            rows={3}
            placeholder="נתוני מעקב, בדיקות חוזרות, תצפיות בייצור…"
          />
          <Textarea
            label="הערות"
            value={effectivenessForm.notes}
            onChange={(event) =>
              setEffectivenessForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEffectivenessOpen(false)}
              disabled={acting}
            >
              ביטול
            </Button>
            <Button type="submit" loading={acting}>
              {effectivenessForm.result === 'true' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              רשום בדיקה
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="עריכת פעולה מתקנת" size="xl">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="כותרת *"
            value={editForm.title}
            onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
          <Textarea
            label="תיאור *"
            value={editForm.description}
            onChange={(event) =>
              setEditForm((prev) => ({ ...prev, description: event.target.value }))
            }
            rows={4}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="סוג פעולה"
              value={editForm.action_type}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, action_type: event.target.value }))
              }
              options={ACTION_TYPE_OPTIONS}
            />
            <Input
              label="תאריך יעד *"
              type="date"
              value={editForm.due_date}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, due_date: event.target.value }))
              }
              required
            />
          </div>
          <Input
            label="תאריך בדיקת אפקטיביות"
            type="date"
            value={editForm.effectiveness_check_date}
            onChange={(event) =>
              setEditForm((prev) => ({ ...prev, effectiveness_check_date: event.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={acting}>
              ביטול
            </Button>
            <Button type="submit" loading={acting}>
              שמור שינויים
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
}
