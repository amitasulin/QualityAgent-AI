'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Gauge,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

const SEVERITY_STRIPE: Record<string, string> = {
  critical: 'bg-danger-500',
  major: 'bg-warning-500',
  minor: 'bg-primary-400',
  observation: 'bg-secondary-300',
};

type StatTone = 'danger' | 'warning' | 'success' | 'primary';

const STAT_TONES: Record<
  StatTone,
  { accent: string; icon: string; bar: string }
> = {
  danger: {
    accent: 'from-danger-500 via-danger-400 to-danger-200',
    icon: 'bg-danger-50 text-danger-600 ring-danger-500/15',
    bar: 'bg-danger-500',
  },
  warning: {
    accent: 'from-warning-500 via-warning-400 to-warning-200',
    icon: 'bg-warning-50 text-warning-600 ring-warning-500/15',
    bar: 'bg-warning-500',
  },
  success: {
    accent: 'from-success-500 via-success-400 to-success-200',
    icon: 'bg-success-50 text-success-600 ring-success-500/15',
    bar: 'bg-success-500',
  },
  primary: {
    accent: 'from-primary-500 via-primary-400 to-primary-200',
    icon: 'bg-primary-50 text-primary-600 ring-primary-100',
    bar: 'bg-primary-500',
  },
};

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  const width = 120;
  const height = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const line = points.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#0284c7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface StatCardProps {
  href: string;
  label: string;
  value: ReactNode;
  unit?: string;
  hint: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: StatTone;
  progress?: number;
  progressLabel?: string;
  spark?: number[];
}

function StatCard({
  href,
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
  progress,
  progressLabel,
  spark,
}: StatCardProps) {
  const tones = STAT_TONES[tone];
  const progressWidth = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary-300 hover:shadow-lg"
    >
      <span className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-l', tones.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-secondary-500">{label}</p>
          <p className="mt-1.5 flex items-baseline gap-1 text-3xl font-extrabold tracking-tight text-secondary-900 tabular-nums">
            {value}
            {unit && <span className="text-base font-semibold text-secondary-400">{unit}</span>}
          </p>
        </div>
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105',
            tones.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs leading-relaxed text-secondary-500">{hint}</p>
        {spark ? (
          <Sparkline values={spark} className="h-9 w-24 shrink-0" />
        ) : typeof progress === 'number' ? (
          <div className="w-24 shrink-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary-100">
              <div
                className={cn('h-full rounded-full transition-all duration-500', tones.bar)}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            {progressLabel && (
              <p className="mt-1 text-left text-[10px] font-medium text-secondary-400">
                {progressLabel}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [runningAgent, setRunningAgent] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');
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

  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
    );
  }, []);

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

  // Y-axis with "nice" ticks so the grid reads cleanly.
  const rawStep = Math.max(1, maxCount / 4);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceStep =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 3 ? 3 : normalized <= 4 ? 4 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const yMax = Math.max(4, niceStep * 4);
  const yTicks = [4, 3, 2, 1, 0].map((i) => Math.round(i * niceStep));

  const average = trend.length ? trendTotal / trend.length : 0;
  const averageLabel = Number.isInteger(average) ? String(average) : average.toFixed(1);
  const lastCount = trend[trend.length - 1]?.count ?? 0;
  const prevCount = trend[trend.length - 2]?.count ?? 0;
  const monthDelta = lastCount - prevCount;

  const openNcrs = metrics?.open_ncrs ?? 0;
  const openCapas = metrics?.open_capas ?? 0;
  const overdueCapas = metrics?.overdue_capas ?? 0;
  const openTasks = metrics?.open_tasks ?? 0;
  const overdueTasks = metrics?.overdue_tasks ?? 0;
  const capaOverdueRate = openCapas > 0 ? (overdueCapas / openCapas) * 100 : 0;
  const taskOverdueRate = openTasks > 0 ? (overdueTasks / openTasks) * 100 : 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-44 animate-pulse rounded-2xl border border-secondary-200 bg-white" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-secondary-200 bg-white"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <div className="h-96 animate-pulse rounded-xl border border-secondary-200 bg-white" />
              <div className="h-72 animate-pulse rounded-xl border border-secondary-200 bg-white" />
            </div>
            <div className="space-y-6 xl:col-span-4">
              <div className="h-72 animate-pulse rounded-xl border border-secondary-200 bg-white" />
              <div className="h-64 animate-pulse rounded-xl border border-secondary-200 bg-white" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-secondary-200 bg-white px-6 py-6 shadow-sm sm:px-7">
          <div className="pointer-events-none absolute -left-24 -top-28 h-64 w-64 rounded-full bg-primary-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-success-50 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-warning-50/70 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
                </span>
                נתונים חיים מכל המודולים
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">
                לוח בקרה
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-secondary-500">
                תמונת מצב של האיכות במפעל — חריגות, פעולות מתקנות, בדיקות ומשימות במקום אחד.
              </p>
              {todayLabel && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-secondary-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {todayLabel}
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => fetchMetrics(true)}
              loading={refreshing}
              className="shrink-0 self-start shadow-sm"
            >
              {!refreshing && <RefreshCw className="h-4 w-4" />}
              רענון נתונים
            </Button>
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-secondary-100 pt-4">
            <span className="ml-1 text-[11px] font-medium text-secondary-400">קיצורי דרך:</span>
            {[
              { href: '/nonconformities', label: 'כל החריגות', icon: AlertTriangle },
              { href: '/corrective-actions', label: 'פעולות מתקנות', icon: CheckSquare },
              { href: '/inspections', label: 'בדיקות איכות', icon: ClipboardCheck },
              { href: '/complaints', label: 'תלונות לקוח', icon: CircleAlert },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-secondary-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-secondary-600 transition-colors hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-700"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </div>
        </section>

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            href="/nonconformities"
            label="אי התאמות פתוחות"
            value={openNcrs}
            hint={`${metrics?.new_ncrs_30d ?? 0} נפתחו ב-30 יום · ${metrics?.closed_ncrs_30d ?? 0} נסגרו`}
            icon={AlertTriangle}
            tone="danger"
            spark={trend.map((t) => t.count)}
          />
          <StatCard
            href="/corrective-actions"
            label="פעולות מתקנות פתוחות"
            value={openCapas}
            hint={
              overdueCapas > 0
                ? `${overdueCapas} באיחור · ${Math.max(0, openCapas - overdueCapas)} בזמן`
                : 'אין פעולות באיחור'
            }
            icon={CheckSquare}
            tone="warning"
            progress={capaOverdueRate}
            progressLabel={`${overdueCapas} באיחור`}
          />
          <StatCard
            href="/inspections"
            label="עמידה בבדיקות"
            value={passRate}
            unit="%"
            hint="אחוז תוצאות הבדיקה שעברו בהצלחה"
            icon={Gauge}
            tone="success"
            progress={passRate}
            progressLabel="יעד 95%"
          />
          <StatCard
            href="/tasks?overdue=true"
            label="משימות באיחור"
            value={overdueTasks}
            hint={`מתוך ${openTasks} משימות פתוחות`}
            icon={Clock}
            tone="primary"
            progress={taskOverdueRate}
            progressLabel={`${overdueTasks} באיחור`}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            {/* Trend chart */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-secondary-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>מגמת אי התאמות</CardTitle>
                    <p className="mt-0.5 text-xs text-secondary-400">חריגות שנפתחו לפי חודש</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                  <div className="text-left">
                    <p className="text-xs text-secondary-400">סה״כ בתקופה</p>
                    <p className="text-lg font-bold text-secondary-900 tabular-nums">{trendTotal}</p>
                    {trend.length > 1 && (
                      <p
                        className={cn(
                          'mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
                          monthDelta > 0
                            ? 'text-danger-600'
                            : monthDelta < 0
                              ? 'text-success-600'
                              : 'text-secondary-400'
                        )}
                      >
                        {monthDelta > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : monthDelta < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {monthDelta === 0
                          ? 'ללא שינוי'
                          : monthDelta > 0
                            ? `עלייה של ${monthDelta} מול חודש קודם`
                            : `ירידה של ${Math.abs(monthDelta)} מול חודש קודם`}
                      </p>
                    )}
                  </div>
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
                  <div>
                    <div className="flex gap-3">
                      {/* Y axis (right side in RTL) */}
                      <div className="mt-7 flex h-52 shrink-0 flex-col justify-between text-[10px] leading-none text-secondary-400 tabular-nums sm:h-56">
                        {yTicks.map((tick) => (
                          <span key={tick}>{tick}</span>
                        ))}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="relative mt-7 h-52 sm:h-56"
                          role="img"
                          aria-label={`מגמת אי התאמות: ${trend
                            .map((t) => `${t.month} ${t.year ?? ''} — ${t.count}`)
                            .join(', ')}`}
                        >
                          {/* Grid */}
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                'pointer-events-none absolute inset-x-0 border-t',
                                i === 4
                                  ? 'border-secondary-200'
                                  : 'border-dashed border-secondary-100'
                              )}
                              style={{ top: `${(i / 4) * 100}%` }}
                            />
                          ))}

                          {/* Average line */}
                          {trendTotal > 0 && (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-[1]"
                              style={{ bottom: `${(average / yMax) * 100}%` }}
                            >
                              <div className="border-t border-dashed border-primary-400/70" />
                              <span className="absolute -top-2.5 right-0 rounded bg-white px-1.5 text-[10px] font-medium text-primary-600">
                                ממוצע {averageLabel}
                              </span>
                            </div>
                          )}

                          {/* Bars */}
                          <div
                            className={cn(
                              'absolute inset-0 z-10 flex items-end justify-between',
                              trend.length > 8 ? 'gap-1' : 'gap-2 sm:gap-3'
                            )}
                          >
                            {trend.map((item, index) => {
                              const isLast = index === trend.length - 1;
                              const heightPct = (item.count / yMax) * 100;
                              const share =
                                trendTotal > 0
                                  ? Math.round((item.count / trendTotal) * 100)
                                  : 0;
                              return (
                                <div
                                  key={`${item.year ?? ''}-${item.month}-${index}`}
                                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                                >
                                  {/* Tooltip */}
                                  <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg bg-secondary-900 px-2.5 py-1.5 text-[11px] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                                  >
                                    <span className="font-semibold">
                                      {item.month} {item.year ?? ''}
                                    </span>
                                    <span className="mx-1 text-secondary-400">·</span>
                                    <span>{item.count} חריגות</span>
                                    {trendTotal > 0 && (
                                      <span className="text-secondary-300"> ({share}%)</span>
                                    )}
                                  </div>

                                  <div
                                    className="relative flex w-full max-w-[46px] flex-col items-center justify-end"
                                    style={
                                      item.count > 0
                                        ? { height: `${Math.max(heightPct, 4)}%` }
                                        : undefined
                                    }
                                  >
                                    {item.count > 0 && (
                                      <span
                                        className={cn(
                                          'absolute -top-6 text-xs font-semibold tabular-nums',
                                          isLast ? 'text-primary-700' : 'text-secondary-500'
                                        )}
                                      >
                                        {item.count}
                                      </span>
                                    )}
                                    <div
                                      className={cn(
                                        'w-full rounded-t-lg transition-all duration-300',
                                        item.count === 0
                                          ? 'h-1 bg-secondary-200 group-hover:bg-secondary-300'
                                          : isLast
                                            ? 'h-full bg-gradient-to-t from-primary-700 via-primary-500 to-primary-300 shadow-lg shadow-primary-500/25 ring-1 ring-inset ring-white/30'
                                            : 'h-full bg-gradient-to-t from-primary-500 to-primary-300/80 group-hover:from-primary-600 group-hover:to-primary-400'
                                      )}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Month labels */}
                        <div
                          className={cn(
                            'mt-2 flex justify-between',
                            trend.length > 8 ? 'gap-1' : 'gap-2 sm:gap-3'
                          )}
                        >
                          {trend.map((item, index) => {
                            const isLast = index === trend.length - 1;
                            const showLabel = trend.length <= 6 || index % 2 === 0 || isLast;
                            return (
                              <div
                                key={`${item.year ?? ''}-${item.month}-label-${index}`}
                                className="min-w-0 flex-1 text-center"
                              >
                                <span
                                  className={cn(
                                    'whitespace-nowrap',
                                    trend.length > 8 ? 'text-[10px]' : 'text-xs',
                                    isLast
                                      ? 'font-semibold text-primary-700'
                                      : 'text-secondary-500'
                                  )}
                                >
                                  {showLabel ? item.month : '\u00A0'}
                                </span>
                                {isLast && (
                                  <span className="mx-auto mt-1 block h-1 w-1 rounded-full bg-primary-500" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Legend + range */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-secondary-100 pt-3">
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-secondary-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-primary-500 to-primary-300" />
                          חריגות שנפתחו
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-0 w-4 border-t border-dashed border-primary-400" />
                          ממוצע לתקופה
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                          החודש הנוכחי
                        </span>
                      </div>
                      <p className="text-xs text-secondary-400">
                        {trend[0].month} {trend[0].year ?? ''} – {trend[trend.length - 1].month}{' '}
                        {trend[trend.length - 1].year ?? ''}
                      </p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Recent NCRs */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3 border-secondary-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600 ring-1 ring-danger-100">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>חריגות אחרונות</CardTitle>
                    <p className="mt-0.5 text-xs text-secondary-400">
                      החריגות האחרונות שנפתחו במערכת
                    </p>
                  </div>
                </div>
                <Link href="/nonconformities">
                  <Button variant="ghost" size="sm">
                    לכל החריגות
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
                        className="group relative flex items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary-50/70"
                      >
                        <span
                          className={cn(
                            'absolute inset-y-3 right-0 w-0.5 rounded-full',
                            SEVERITY_STRIPE[ncr.severity] || 'bg-secondary-300'
                          )}
                        />
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-50 text-secondary-500 ring-1 ring-secondary-100 group-hover:bg-white group-hover:text-danger-600">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-secondary-400">
                              {ncr.number}
                            </span>
                            <SeverityBadge severity={ncr.severity} />
                            <StatusBadge status={ncr.status} type="ncr" />
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-secondary-900 group-hover:text-primary-700">
                            {ncr.title}
                          </p>
                        </div>
                        <div className="hidden shrink-0 text-left sm:block">
                          <p className="text-xs text-secondary-400">
                            {formatRelativeTime(ncr.detected_at)}
                          </p>
                        </div>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-secondary-300 transition-colors group-hover:text-primary-500" />
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

            {/* AI insight */}
            <Card className="relative overflow-hidden border-primary-700 bg-gradient-to-bl from-primary-600 via-primary-700 to-primary-800 text-white">
              <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-primary-400/20 blur-3xl" />
              <CardBody className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">תובנת AI</h3>
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/20">
                        סוכן איכות
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-primary-50">
                      {metrics?.ai_insight || 'אין תובנות זמינות כרגע'}
                    </p>
                    <Link
                      href="/agent"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
                    >
                      מעבר לסוכן AI
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Side column */}
          <div className="space-y-6 xl:col-span-4">
            {/* My tasks */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3 border-secondary-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                    <CheckSquare className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      המשימות שלי
                      {(metrics?.my_open_tasks ?? 0) > 0 && (
                        <Badge variant="primary">{metrics?.my_open_tasks}</Badge>
                      )}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-secondary-400">משימות שממתינות לך</p>
                  </div>
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
                          className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-secondary-50/70"
                        >
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                              isOverdue ? 'bg-danger-500' : 'bg-primary-400'
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-secondary-900">
                              {task.title}
                            </p>
                            <p
                              className={cn(
                                'mt-1 text-xs',
                                isOverdue
                                  ? 'font-medium text-danger-600'
                                  : 'text-secondary-400'
                              )}
                            >
                              {task.due_date
                                ? `יעד: ${formatDate(task.due_date)}`
                                : 'ללא מועד יעד'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
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

            {/* Upcoming due dates */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center gap-3 border-secondary-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-100">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>מועדי יעד קרובים</CardTitle>
                  <p className="mt-0.5 text-xs text-secondary-400">פעולות ומשימות לפי דחיפות</p>
                </div>
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
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-secondary-50/70"
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
                            <p className="truncate text-sm font-medium text-secondary-900">
                              {item.title}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-secondary-400">
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

            {/* AI recommendations */}
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3 border-secondary-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                    <Brain className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>המלצות סוכן AI</CardTitle>
                    <p className="mt-0.5 text-xs text-secondary-400">המלצות ממתינות לטיפול</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={runAgent} loading={runningAgent}>
                  {!runningAgent && <RefreshCw className="h-3.5 w-3.5" />}
                  הרצת סוכן
                </Button>
              </CardHeader>
              <CardBody className="p-0">
                {metrics?.recent_recommendations?.length ? (
                  <div className="divide-y divide-secondary-100">
                    {metrics.recent_recommendations.slice(0, 3).map((rec) => (
                      <Link
                        key={rec.id}
                        href="/agent"
                        className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-secondary-50/70"
                      >
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            SEVERITY_DOT[rec.severity] || 'bg-secondary-300'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary-900">{rec.title}</p>
                          <p className="mt-0.5 text-xs text-secondary-400">
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
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
