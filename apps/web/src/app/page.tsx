'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardMetrics {
  open_ncrs: number;
  open_capas: number;
  inspection_pass_rate: number;
  overdue_tasks: number;
  ncr_trend: Array<{ month: string; year?: number; count: number }>;
  ai_insight: string;
  recent_ncrs: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    severity: string;
    detected_at: string;
  }>;
  recent_recommendations: Array<{
    id: string;
    type: string;
    title: string;
    severity: string;
    created_at: string;
  }>;
  upcoming_due_dates: Array<{
    id: string;
    title: string;
    due_date: string;
    days_remaining: number;
    kind?: 'capa' | 'task';
  }>;
  new_ncrs_30d: number;
  closed_ncrs_30d: number;
  overdue_capas: number;
  open_tasks: number;
  my_open_tasks: number;
  my_tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date?: string | null;
  }>;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-danger-500',
  warning: 'bg-warning-500',
  info: 'bg-primary-500',
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [runningAgent, setRunningAgent] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchMetrics = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh || hasLoadedRef.current) setRefreshing(true);
        else setLoading(true);
        const data = await api.getDashboardMetrics({ months });
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError('שגיאה בטעינת נתוני הדשבורד');
        console.error(err);
      } finally {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [months]
  );

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const runAgent = async () => {
    setRunningAgent(true);
    try {
      await api.triggerAgentRun('manual');
      toast.success('הסוכן הופעל — ההמלצות יתעדכנו בקרוב');
      await fetchMetrics(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'הפעלת הסוכן נכשלה'));
    } finally {
      setRunningAgent(false);
    }
  };

  const trend = metrics?.ncr_trend ?? [];
  const maxCount = Math.max(1, ...trend.map((t) => t.count));
  const trendTotal = trend.reduce((sum, item) => sum + item.count, 0);
  const passRate = metrics?.inspection_pass_rate ?? 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-40 rounded bg-secondary-200 animate-pulse" />
              <div className="h-4 w-56 rounded bg-secondary-100 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="h-3.5 w-24 rounded bg-secondary-100" />
                      <div className="h-8 w-16 rounded bg-secondary-200" />
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-secondary-100" />
                  </div>
                  <div className="h-3 w-32 rounded bg-secondary-50 mt-4" />
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 animate-pulse">
              <CardBody className="p-6">
                <div className="h-4 w-40 rounded bg-secondary-100" />
                <div className="h-64 rounded bg-secondary-50 mt-6" />
              </CardBody>
            </Card>
            <Card className="animate-pulse">
              <CardBody className="p-6 space-y-4">
                <div className="h-4 w-28 rounded bg-secondary-100" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded bg-secondary-50" />
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          title="לוח בקרה"
          subtitle="סקירת מצב האיכות במפעל — נתונים חיים מכל המודולים"
          actions={
            <Button variant="secondary" onClick={() => fetchMetrics(true)} loading={refreshing}>
              {!refreshing && <RefreshCw className="h-4 w-4" />}
              רענון נתונים
            </Button>
          }
        />

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </span>
            <Button variant="ghost" size="sm" onClick={() => fetchMetrics(true)}>
              נסה שוב
            </Button>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link href="/nonconformities" className="block group">
            <KpiCard
              label="אי התאמות פתוחות"
              value={metrics?.open_ncrs ?? 0}
              hint={`${metrics?.new_ncrs_30d ?? 0} נפתחו ב-30 יום · ${metrics?.closed_ncrs_30d ?? 0} נסגרו`}
              icon={AlertTriangle}
              tone="danger"
              className="h-full transition-shadow group-hover:shadow-md"
            />
          </Link>
          <Link href="/corrective-actions" className="block group">
            <KpiCard
              label="פעולות מתקנות פתוחות"
              value={metrics?.open_capas ?? 0}
              hint={
                (metrics?.overdue_capas ?? 0) > 0
                  ? `${metrics?.overdue_capas} באיחור · דורש טיפול`
                  : 'אין פעולות באיחור'
              }
              icon={CheckSquare}
              tone="warning"
              className="h-full transition-shadow group-hover:shadow-md"
            />
          </Link>
          <Link href="/inspections" className="block group">
            <KpiCard
              label="עמידה בבדיקות"
              value={`${passRate}%`}
              hint="אחוז התוצאות שעברו מתוך כלל הבדיקות"
              icon={TrendingUp}
              tone="success"
              progress={passRate}
              className="h-full transition-shadow group-hover:shadow-md"
            />
          </Link>
          <Link href="/tasks?overdue=true" className="block group">
            <KpiCard
              label="משימות באיחור"
              value={metrics?.overdue_tasks ?? 0}
              hint={
                (metrics?.overdue_tasks ?? 0) > 0
                  ? `מתוך ${metrics?.open_tasks ?? 0} משימות פתוחות`
                  : `אין איחורים · ${metrics?.open_tasks ?? 0} משימות פתוחות`
              }
              icon={Clock}
              tone="secondary"
              className="h-full transition-shadow group-hover:shadow-md"
            />
          </Link>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Trend chart */}
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Activity className="h-5 w-5 text-primary-600" />
                  <CardTitle>מגמת אי התאמות</CardTitle>
                  <div
                    className="flex items-center rounded-lg border border-secondary-200 bg-secondary-50 p-0.5"
                    role="group"
                    aria-label="טווח זמן למגמה"
                  >
                    {[6, 12].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMonths(value)}
                        aria-pressed={months === value}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          months === value
                            ? 'bg-white text-secondary-900 shadow-sm'
                            : 'text-secondary-500 hover:text-secondary-700'
                        )}
                      >
                        {value} חודשים
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs text-secondary-400">סה״כ בתקופה</p>
                  <p className="text-lg font-bold text-secondary-900 tabular-nums">{trendTotal}</p>
                </div>
              </CardHeader>
              <CardBody>
                {trend.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="אין נתוני מגמה"
                    description="לא נמצאו אי-התאמות בתקופה הנבחרת"
                    className="py-8"
                  />
                ) : (
                  <div className="relative">
                    <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="border-t border-dashed border-secondary-100" />
                      ))}
                    </div>
                    <div
                      className={cn(
                        'relative flex items-end justify-between h-64 pb-7',
                        trend.length > 8 ? 'gap-1' : 'gap-2 sm:gap-4'
                      )}
                    >
                      {trend.map((item, index) => {
                        const height = Math.max(6, (item.count / maxCount) * 190);
                        const isLast = index === trend.length - 1;
                        const showLabel = trend.length <= 6 || index % 2 === 0 || isLast;
                        return (
                          <div
                            key={`${item.year ?? ''}-${item.month}-${index}`}
                            className="flex-1 flex flex-col items-center justify-end min-w-0 h-full group"
                            title={`${item.month} ${item.year ?? ''}: ${item.count} חריגות`}
                          >
                            <span className="text-xs font-semibold text-secondary-500 tabular-nums mb-1.5">
                              {item.count}
                            </span>
                            <div
                              className={cn(
                                'w-full max-w-[46px] rounded-t-lg transition-all duration-300',
                                isLast
                                  ? 'bg-gradient-to-t from-primary-600 to-primary-400'
                                  : 'bg-gradient-to-t from-primary-500/70 to-primary-300 group-hover:from-primary-600 group-hover:to-primary-400'
                              )}
                              style={{ height: `${height}px` }}
                            />
                            <span
                              className={cn(
                                'absolute bottom-0 text-secondary-500 whitespace-nowrap',
                                trend.length > 8 ? 'text-[10px]' : 'text-xs'
                              )}
                            >
                              {showLabel ? item.month : '\u00A0'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {trend.length > 0 && (
                      <p className="mt-1 text-center text-xs text-secondary-400">
                        {trend[0].month} {trend[0].year ?? ''} – {trend[trend.length - 1].month}{' '}
                        {trend[trend.length - 1].year ?? ''}
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* AI insight */}
            <Card className="border-primary-200 bg-gradient-to-bl from-primary-50 via-white to-white overflow-hidden">
              <CardBody className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 flex items-center justify-center shrink-0">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-secondary-900">תובנת AI</h3>
                      <Badge variant="primary">סוכן איכות</Badge>
                    </div>
                    <p className="text-secondary-700 mt-2 leading-relaxed">
                      {metrics?.ai_insight || 'אין תובנות זמינות כרגע'}
                    </p>
                    <Link
                      href="/agent"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 mt-3"
                    >
                      מעבר לסוכן AI
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            {/* My tasks */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary-600" />
                  <CardTitle>המשימות שלי</CardTitle>
                  {(metrics?.my_open_tasks ?? 0) > 0 && (
                    <Badge variant="primary">{metrics?.my_open_tasks}</Badge>
                  )}
                </div>
                <Link href="/tasks?my_tasks=true">
                  <Button variant="ghost" size="sm">
                    הצג הכל
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardBody className="p-0">
                {metrics?.my_tasks?.length ? (
                  <div className="divide-y divide-secondary-100">
                    {metrics.my_tasks.map((task) => {
                      const isOverdue = task.due_date
                        ? new Date(task.due_date) < new Date()
                        : false;
                      return (
                        <Link
                          key={task.id}
                          href={`/tasks/${task.id}`}
                          className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary-50/70 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-secondary-900 truncate">
                              {task.title}
                            </p>
                            <p
                              className={cn(
                                'text-xs mt-1',
                                isOverdue ? 'text-danger-600 font-medium' : 'text-secondary-400'
                              )}
                            >
                              {task.due_date
                                ? `יעד: ${formatDate(task.due_date)}`
                                : 'ללא מועד יעד'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <StatusBadge status={task.status} type="task" />
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title="אין משימות פתוחות"
                    description="אין משימות המיועדות לך כרגע"
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>

            {/* Recent NCRs */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-danger-500" />
                  <CardTitle>חריגות אחרונות</CardTitle>
                </div>
                <Link href="/nonconformities">
                  <Button variant="ghost" size="sm">
                    הצג הכל
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardBody className="p-0">
                {metrics?.recent_ncrs?.length ? (
                  <div className="divide-y divide-secondary-100">
                    {metrics.recent_ncrs.slice(0, 5).map((ncr) => (
                      <Link
                        key={ncr.id}
                        href={`/nonconformities/${ncr.id}`}
                        className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary-50/70 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-secondary-400">
                              {ncr.number}
                            </span>
                            <SeverityBadge severity={ncr.severity} />
                          </div>
                          <p className="text-sm font-medium text-secondary-900 truncate mt-1">
                            {ncr.title}
                          </p>
                          <p className="text-xs text-secondary-400 mt-0.5">
                            {formatRelativeTime(ncr.detected_at)}
                          </p>
                        </div>
                        <StatusBadge status={ncr.status} type="ncr" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title="אין חריגות פתוחות"
                    description="כל החריגות טופלו"
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>

            {/* AI recommendations */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary-600" />
                  <CardTitle>המלצות סוכן AI</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {!!metrics?.recent_recommendations?.length && (
                    <Badge variant="warning">{metrics.recent_recommendations.length} ממתינות</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={runAgent} loading={runningAgent}>
                    {!runningAgent && <RefreshCw className="h-3.5 w-3.5" />}
                    הרצת סוכן
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {metrics?.recent_recommendations?.length ? (
                  <div className="divide-y divide-secondary-100">
                    {metrics.recent_recommendations.slice(0, 3).map((rec) => (
                      <Link
                        key={rec.id}
                        href="/agent"
                        className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary-50/70 transition-colors"
                      >
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 rounded-full shrink-0',
                            SEVERITY_DOT[rec.severity] || 'bg-secondary-300'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary-900">{rec.title}</p>
                          <p className="text-xs text-secondary-400 mt-0.5">
                            {formatRelativeTime(rec.created_at)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Brain}
                    title="אין המלצות ממתינות"
                    description="הסוכן לא זיהה המלצות חדשות"
                    className="py-8"
                    action={
                      <Button size="sm" onClick={runAgent} loading={runningAgent}>
                        הפעל בדיקה יזומה
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>

            {/* Upcoming due dates */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-warning-500" />
                <CardTitle>מועדי יעד קרובים</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {metrics?.upcoming_due_dates?.length ? (
                  <div className="divide-y divide-secondary-100">
                    {metrics.upcoming_due_dates.slice(0, 5).map((item) => (
                      <Link
                        key={`${item.kind ?? 'capa'}-${item.id}`}
                        href={
                          item.kind === 'task'
                            ? `/tasks/${item.id}`
                            : `/corrective-actions/${item.id}`
                        }
                        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-secondary-50/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={item.kind === 'task' ? 'primary' : 'warning'}
                              size="sm"
                              className="shrink-0"
                            >
                              {item.kind === 'task' ? 'משימה' : 'CAPA'}
                            </Badge>
                            <p className="text-sm font-medium text-secondary-900 truncate">
                              {item.title}
                            </p>
                          </div>
                          <p className="text-xs text-secondary-400 mt-1">
                            {formatDate(item.due_date)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.days_remaining < 0
                              ? 'danger'
                              : item.days_remaining <= 2
                                ? 'danger'
                                : item.days_remaining <= 5
                                  ? 'warning'
                                  : 'primary'
                          }
                          className="shrink-0"
                        >
                          {item.days_remaining < 0
                            ? `${Math.abs(item.days_remaining)} ימי איחור`
                            : item.days_remaining === 0
                              ? 'היום'
                              : `${item.days_remaining} ימים`}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title="אין מועדי יעד קרובים"
                    description="אין פעולות מתקנות או משימות עם מועדי יעד פתוחים"
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
