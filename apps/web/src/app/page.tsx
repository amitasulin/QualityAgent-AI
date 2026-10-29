'use client';

import { useEffect, useState } from 'react';
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
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardMetrics {
  open_ncrs: number;
  open_capas: number;
  inspection_pass_rate: number;
  overdue_tasks: number;
  ncr_trend: Array<{ month: string; count: number }>;
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

  const fetchMetrics = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data = await api.getDashboardMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת נתוני הדשבורד');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

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
              hint="לחץ לצפייה בכל החריגות"
              icon={AlertTriangle}
              tone="danger"
              className="h-full transition-shadow group-hover:shadow-md"
            />
          </Link>
          <Link href="/corrective-actions" className="block group">
            <KpiCard
              label="פעולות מתקנות פתוחות"
              value={metrics?.open_capas ?? 0}
              hint="מעקב אחר CAPA עד לסגירה"
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
          <KpiCard
            label="משימות באיחור"
            value={metrics?.overdue_tasks ?? 0}
            hint={
              (metrics?.overdue_tasks ?? 0) > 0
                ? 'דורש טיפול מיידי'
                : 'אין משימות באיחור — כל הכבוד'
            }
            icon={Clock}
            tone="secondary"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Trend chart */}
            <Card>
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary-600" />
                  <CardTitle>מגמת אי התאמות</CardTitle>
                  <Badge variant="secondary">6 חודשים</Badge>
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
                    <div className="relative flex items-end justify-between gap-2 sm:gap-4 h-64 pb-7">
                      {trend.map((item, index) => {
                        const height = Math.max(6, (item.count / maxCount) * 190);
                        const isLast = index === trend.length - 1;
                        return (
                          <div
                            key={`${item.month}-${index}`}
                            className="flex-1 flex flex-col items-center justify-end min-w-0 h-full group"
                            title={`${item.month}: ${item.count} חריגות`}
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
                            <span className="absolute bottom-0 text-xs text-secondary-500">
                              {item.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                {!!metrics?.recent_recommendations?.length && (
                  <Badge variant="warning">{metrics.recent_recommendations.length} ממתינות</Badge>
                )}
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
                      <Button
                        size="sm"
                        onClick={() => api.triggerAgentRun('manual')}
                      >
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
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-secondary-50/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-secondary-400 mt-0.5">
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
                        >
                          {item.days_remaining < 0
                            ? `${Math.abs(item.days_remaining)} ימי איחור`
                            : item.days_remaining === 0
                              ? 'היום'
                              : `${item.days_remaining} ימים`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title="אין מועדי יעד קרובים"
                    description="אין פעולות מתקנות עם מועדי יעד פתוחים"
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
