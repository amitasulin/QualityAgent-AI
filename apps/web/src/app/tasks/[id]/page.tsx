'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock,
  Link2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  task_type?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  completed_at?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

const typeLabels: Record<string, string> = {
  ncr_review: 'סקירת חריגה',
  capa_action: 'פעולה מתקנת',
  document_review: 'סקירת מסמך',
  audit: 'ביקורת',
  custom: 'אחר',
};

const STATUS_ACCENT: Record<string, string> = {
  todo: 'bg-secondary-300',
  in_progress: 'bg-primary-500',
  review: 'bg-warning-500',
  done: 'bg-success-500',
  cancelled: 'bg-danger-500',
};

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!task) return;
    setCompleting(true);
    setActionError(null);
    try {
      const updated = await api.completeTask(task.id);
      setTask(updated);
    } catch (err) {
      console.error(err);
      setActionError('סימון המשימה כהושלמה נכשל');
    } finally {
      setCompleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getTask(params.id);
        if (!cancelled) setTask(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת המשימה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const accent = task ? STATUS_ACCENT[task.status] || 'bg-secondary-300' : 'bg-secondary-300';

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה למשימות
        </Link>

        {loading ? (
          <Card>
            <CardBody className="p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-1/4 rounded bg-secondary-100" />
                <div className="h-8 w-1/2 rounded bg-secondary-100" />
              </div>
            </CardBody>
          </Card>
        ) : error || !task ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'המשימה לא נמצאה'}</p>
              <Link href="/tasks">
                <Button variant="secondary" className="mt-4">
                  חזרה למשימות
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className={cn('h-1.5 w-full', accent)} />
              <CardBody className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 flex items-center justify-center shrink-0">
                    <CheckSquare className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={task.status} type="task" />
                      <PriorityBadge priority={task.priority} />
                      {task.task_type && (
                        <Badge variant="secondary">{typeLabels[task.task_type] || task.task_type}</Badge>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-secondary-900 mt-2">{task.title}</h1>
                    {task.due_date && (
                      <p className="text-sm text-secondary-500 mt-1">
                        תאריך יעד: {formatDateTime(task.due_date)}
                      </p>
                    )}
                    {task.status !== 'done' && task.status !== 'cancelled' && (
                      <Button
                        className="mt-4"
                        size="sm"
                        onClick={handleComplete}
                        loading={completing}
                      >
                        {!completing && <CheckCircle2 className="h-4 w-4" />}
                        סמן כהושלמה
                      </Button>
                    )}
                    {actionError && (
                      <p className="mt-2 text-sm text-danger-600">{actionError}</p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardBody className="p-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-secondary-100">
                  <StatTile label="סטטוס" value={<StatusBadge status={task.status} type="task" />} hint="מצב המשימה" />
                  <StatTile label="עדיפות" value={<PriorityBadge priority={task.priority} />} hint="דחיפות הטיפול" />
                  <StatTile
                    label="תאריך יעד"
                    value={task.due_date ? formatDateTime(task.due_date).split(',')[0] : '—'}
                    hint="מועד השלמה"
                  />
                  <StatTile
                    label="הושלמה?"
                    value={task.completed_at ? 'כן' : 'לא'}
                    hint={task.completed_at ? formatDateTime(task.completed_at) : 'טרם הושלמה'}
                    tone={task.completed_at ? 'success' : 'neutral'}
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary-600" />
                  <CardTitle>תיאור</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">
                    {task.description || '—'}
                  </p>
                </CardBody>
              </Card>

              <Card className="h-fit">
                <CardHeader className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-secondary-500" />
                  <CardTitle>קישורים</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {task.related_entity_type === 'corrective_action' && task.related_entity_id && (
                    <Link
                      href={`/corrective-actions/${task.related_entity_id}`}
                      className="flex items-center justify-between rounded-lg border border-secondary-200 px-3 py-2.5 text-sm text-secondary-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
                    >
                      פעולה מתקנת מקושרת
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </Link>
                  )}
                  {task.related_entity_type === 'nonconformity' && task.related_entity_id && (
                    <Link
                      href={`/nonconformities/${task.related_entity_id}`}
                      className="flex items-center justify-between rounded-lg border border-secondary-200 px-3 py-2.5 text-sm text-secondary-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
                    >
                      חריגה מקושרת
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </Link>
                  )}
                  {!task.related_entity_id && (
                    <p className="text-sm text-secondary-500">אין קישורים למשימה זו</p>
                  )}
                  <div className="flex items-center gap-2 pt-2 text-xs text-secondary-400">
                    <Clock className="h-3.5 w-3.5" />
                    {task.completed_at
                      ? `הושלמה ב־${formatDateTime(task.completed_at)}`
                      : 'המשימה טרם הושלמה'}
                  </div>
                  {task.due_date && (
                    <div className="flex items-center gap-2 text-xs text-secondary-400">
                      <CalendarClock className="h-3.5 w-3.5" />
                      יעד: {formatDateTime(task.due_date)}
                    </div>
                  )}
                  {task.completed_at && (
                    <div className="flex items-center gap-2 text-xs text-success-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      הושלמה בהצלחה
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
