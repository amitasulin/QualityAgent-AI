'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
} from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn, formatDate } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  incoming: 'בדיקת קבלה',
  in_process: 'בדיקת תהליך',
  final: 'בדיקה סופית',
  audit: 'ביקורת',
};

const TYPE_DOTS: Record<string, string> = {
  incoming: 'bg-primary-500',
  in_process: 'bg-warning-500',
  final: 'bg-success-500',
  audit: 'bg-secondary-400',
};

const FREQUENCY_LABELS: Record<string, string> = {
  per_lot: 'לכל אצווה',
  per_batch: 'לכל מנה',
  every_2_hours: 'כל שעתיים',
  every_shift: 'כל משמרת',
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
};

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
  created_at: string;
  ncr_id?: string | null;
  product?: { id: string; sku: string; name: string } | null;
  site?: { id: string; name: string; code?: string | null } | null;
  inspector?: { id: string; full_name: string } | null;
  plan?: { id: string; code: string; name: string } | null;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  inspection_type: string;
  frequency: string;
  sample_size: number;
  characteristics: string[];
  is_active: boolean;
  inspections_count: number;
  product?: { id: string; sku: string; name: string } | null;
  site?: { id: string; name: string; code?: string | null } | null;
}

interface Stats {
  total: number;
  planned: number;
  in_progress: number;
  passed: number;
  failed: number;
  pass_rate: number;
  results_total: number;
  results_failed: number;
  open_findings: number;
}

interface RefOption {
  id: string;
  label: string;
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  progress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'primary' | 'success' | 'danger' | 'warning';
  progress?: number;
}) {
  const tones = {
    primary: {
      wrap: 'from-primary-50 to-white border-primary-100',
      icon: 'bg-primary-100 text-primary-700',
      value: 'text-secondary-900',
      bar: 'bg-primary-500',
    },
    success: {
      wrap: 'from-success-50 to-white border-success-50',
      icon: 'bg-success-50 text-success-600',
      value: 'text-success-600',
      bar: 'bg-success-500',
    },
    danger: {
      wrap: 'from-danger-50 to-white border-danger-50',
      icon: 'bg-danger-50 text-danger-600',
      value: 'text-danger-600',
      bar: 'bg-danger-500',
    },
    warning: {
      wrap: 'from-warning-50 to-white border-warning-50',
      icon: 'bg-warning-50 text-warning-600',
      value: 'text-secondary-900',
      bar: 'bg-warning-500',
    },
  }[tone];

  return (
    <Card className={cn('bg-gradient-to-bl border', tones.wrap)}>
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-secondary-500">{label}</p>
            <p className={cn('text-3xl font-extrabold mt-1 tabular-nums', tones.value)}>{value}</p>
          </div>
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tones.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {typeof progress === 'number' && (
          <div className="h-1.5 rounded-full bg-white/80 border border-secondary-100 mt-4 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', tones.bar)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
        {hint && <p className="text-xs text-secondary-400 mt-3">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function PassRateBar({ rate }: { rate?: number | null }) {
  if (rate === null || rate === undefined) {
    return <span className="text-secondary-300">—</span>;
  }
  const color = rate >= 95 ? 'bg-success-500' : rate >= 80 ? 'bg-warning-500' : 'bg-danger-500';
  const text = rate >= 95 ? 'text-success-600' : rate >= 80 ? 'text-warning-600' : 'text-danger-600';
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="h-1.5 w-14 rounded-full bg-secondary-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', text)}>{rate}%</span>
    </div>
  );
}

export default function InspectionsPage() {
  const [tab, setTab] = useState<'inspections' | 'plans'>('inspections');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });
  const [filters, setFilters] = useState({ search: '', status: '', inspection_type: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [plansQuery, setPlansQuery] = useState({
    page: 1,
    pageSize: 20,
    sortBy: 'code',
    sortOrder: 'asc' as 'asc' | 'desc',
  });
  const [plansPagination, setPlansPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  const [showCreateInspection, setShowCreateInspection] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.status) params.status = filters.status;
      if (filters.inspection_type) params.inspection_type = filters.inspection_type;
      const data = await api.getInspections(params);
      setInspections(data.items);
      setPagination({
        page: data.page,
        page_size: data.page_size,
        total: data.total,
        total_pages: data.total_pages,
        has_next: data.has_next ?? data.page < data.total_pages,
        has_prev: data.has_prev ?? data.page > 1,
      });
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הבדיקות');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters.status, filters.inspection_type, debouncedSearch, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await api.getInspectionStats());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const data = await api.getInspectionPlans({
        page: plansQuery.page,
        page_size: plansQuery.pageSize,
        sort_by: plansQuery.sortBy,
        sort_order: plansQuery.sortOrder,
      });
      setPlans(data.items);
      setPlansPagination({
        page: data.page,
        page_size: data.page_size,
        total: data.total,
        total_pages: data.total_pages,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setPlansLoading(false);
    }
  }, [plansQuery]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchInspections(), fetchStats(), fetchPlans()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (field: string) => {
    setPage(1);
    setSortBy(field);
    setSortOrder((prev) => (sortBy === field && prev === 'asc' ? 'desc' : 'asc'));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handlePlanSort = (field: string) => {
    setPlansQuery((prev) => ({
      ...prev,
      page: 1,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePlanPageChange = (nextPage: number) => {
    setPlansQuery((prev) => ({ ...prev, page: nextPage }));
  };

  const handlePlanPageSizeChange = (size: number) => {
    setPlansQuery((prev) => ({ ...prev, pageSize: size, page: 1 }));
  };

  const passedResults = stats ? stats.results_total - stats.results_failed : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-secondary-900">בדיקות איכות</h1>
                <Badge variant="primary">{stats?.total ?? 0} בדיקות</Badge>
              </div>
              <p className="text-secondary-500 mt-1">
                ניהול תוכניות בדיקה, ביצוע בדיקות קבלה ותהליך ותיעוד תוצאות
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={refreshAll} loading={refreshing}>
              {!refreshing && <RefreshCw className="h-4 w-4" />}
              רענון
            </Button>
            <Button onClick={() => (tab === 'plans' ? setShowCreatePlan(true) : setShowCreateInspection(true))}>
              <Plus className="h-4 w-4" />
              {tab === 'plans' ? 'תוכנית בדיקה חדשה' : 'בדיקה חדשה'}
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label='סה"כ בדיקות'
            value={stats?.total ?? '—'}
            hint={stats ? `${stats.planned} מתוכננות · ${stats.in_progress} בביצוע` : undefined}
            icon={ClipboardList}
            tone="primary"
          />
          <KpiCard
            label="אחוז עמידה"
            value={stats ? `${stats.pass_rate}%` : '—'}
            hint={stats ? `${passedResults} מתוך ${stats.results_total} תוצאות עברו` : undefined}
            icon={CheckCircle2}
            tone="success"
            progress={stats?.pass_rate}
          />
          <KpiCard
            label="בדיקות שנכשלו"
            value={stats?.failed ?? '—'}
            hint={stats ? `${stats.results_failed} ממצאים חורגים` : undefined}
            icon={XCircle}
            tone="danger"
          />
          <KpiCard
            label="פתוחות לביצוע"
            value={stats ? stats.planned + stats.in_progress : '—'}
            hint={stats ? `${stats.open_findings} אי-התאמות פתוחות` : undefined}
            icon={FlaskConical}
            tone="warning"
          />
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary-100 p-1">
          <button
            onClick={() => setTab('inspections')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === 'inspections'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-secondary-500 hover:text-secondary-800'
            )}
          >
            <ClipboardList className="h-4 w-4" />
            בדיקות
            <span className="text-xs rounded-full bg-secondary-100 px-1.5 py-0.5 tabular-nums">{stats?.total ?? 0}</span>
          </button>
          <button
            onClick={() => setTab('plans')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === 'plans'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-secondary-500 hover:text-secondary-800'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            תוכניות בדיקה
            <span className="text-xs rounded-full bg-secondary-100 px-1.5 py-0.5 tabular-nums">{plans.length}</span>
          </button>
        </div>

        {tab === 'inspections' ? (
          <>
            {/* Filters */}
            <Card>
              <CardBody className="p-4">
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      placeholder="חיפוש לפי מספר בדיקה, אצווה או הערות..."
                      value={filters.search}
                      onChange={(e) => {
                        setPage(1);
                        setFilters((prev) => ({ ...prev, search: e.target.value }));
                      }}
                      className="pr-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={filters.inspection_type}
                      onChange={(e) => {
                        setPage(1);
                        setFilters((prev) => ({ ...prev, inspection_type: e.target.value }));
                      }}
                      options={[
                        { value: '', label: 'כל הסוגים' },
                        ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
                      ]}
                      className="w-40"
                    />
                    <Select
                      value={filters.status}
                      onChange={(e) => {
                        setPage(1);
                        setFilters((prev) => ({ ...prev, status: e.target.value }));
                      }}
                      options={[
                        { value: '', label: 'כל הסטטוסים' },
                        { value: 'planned', label: 'מתוכננת' },
                        { value: 'in_progress', label: 'בביצוע' },
                        { value: 'passed', label: 'עבר' },
                        { value: 'failed', label: 'נכשל' },
                        { value: 'on_hold', label: 'בהמתנה' },
                      ]}
                      className="w-40"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPage(1);
                        setFilters({ search: '', status: '', inspection_type: '' });
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      איפוס
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardBody className="p-0">
                {loading ? (
                  <div className="divide-y divide-secondary-100">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                        <div className="h-9 w-9 rounded-lg bg-secondary-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-1/4 rounded bg-secondary-100" />
                          <div className="h-3 w-1/3 rounded bg-secondary-50" />
                        </div>
                        <div className="h-6 w-20 rounded-full bg-secondary-100" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-12 text-center">
                    <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
                    <p className="mt-3 text-danger-600">{error}</p>
                    <Button variant="secondary" className="mt-4" onClick={refreshAll}>
                      <RefreshCw className="h-4 w-4" />
                      נסה שוב
                    </Button>
                  </div>
                ) : inspections.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-secondary-100 flex items-center justify-center mx-auto">
                      <ClipboardList className="h-7 w-7 text-secondary-400" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-secondary-900">לא נמצאו בדיקות</h3>
                    <p className="text-sm text-secondary-500 mt-1">
                      {filters.search || filters.status || filters.inspection_type
                        ? 'נסה לשנות את הסינון או לאפס אותו'
                        : 'צור בדיקה חדשה כדי להתחיל לתעד תוצאות איכות'}
                    </p>
                    <Button className="mt-5" onClick={() => setShowCreateInspection(true)}>
                      <Plus className="h-4 w-4" />
                      בדיקה חדשה
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableTableHead field="number" activeField={sortBy} direction={sortOrder} onSort={handleSort}>
                              מספר
                            </SortableTableHead>
                            <SortableTableHead field="inspection_type" activeField={sortBy} direction={sortOrder} onSort={handleSort}>
                              סוג
                            </SortableTableHead>
                            <TableHead>מוצר / אתר</TableHead>
                            <SortableTableHead field="lot_number" activeField={sortBy} direction={sortOrder} onSort={handleSort} className="hidden xl:table-cell">
                              אצווה
                            </SortableTableHead>
                            <TableHead>תוצאות</TableHead>
                            <TableHead>עמידה</TableHead>
                            <SortableTableHead field="status" activeField={sortBy} direction={sortOrder} onSort={handleSort}>
                              סטטוס
                            </SortableTableHead>
                            <SortableTableHead field="inspected_at" activeField={sortBy} direction={sortOrder} onSort={handleSort}>
                              תאריך
                            </SortableTableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inspections.map((inspection) => (
                            <TableRow key={inspection.id} className="group">
                              <TableCell className="whitespace-nowrap">
                                <Link
                                  href={`/inspections/${inspection.id}`}
                                  className="font-mono text-sm font-semibold text-secondary-900 group-hover:text-primary-700"
                                >
                                  {inspection.number}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-2 text-sm text-secondary-700">
                                  <span className={cn('h-2 w-2 rounded-full', TYPE_DOTS[inspection.inspection_type] || 'bg-secondary-300')} />
                                  {TYPE_LABELS[inspection.inspection_type] || inspection.inspection_type}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="text-secondary-900 font-medium">{inspection.product?.name || '—'}</div>
                                <div className="text-xs text-secondary-400">{inspection.site?.name || ''}</div>
                              </TableCell>
                              <TableCell className="hidden xl:table-cell font-mono text-xs text-secondary-500">{inspection.lot_number || '—'}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-full bg-secondary-50 border border-secondary-200 px-2 py-0.5 text-xs">
                                  <span className="font-semibold text-success-600 tabular-nums">{inspection.passed_count}</span>
                                  <span className="text-secondary-300">/</span>
                                  <span className="font-semibold text-danger-600 tabular-nums">{inspection.failed_count}</span>
                                  <span className="text-secondary-400">מתוך {inspection.sample_size}</span>
                                </span>
                              </TableCell>
                              <TableCell>
                                <PassRateBar rate={inspection.pass_rate} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={inspection.status} type="inspection" />
                              </TableCell>
                              <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                                {inspection.inspected_at ? formatDate(inspection.inspected_at) : formatDate(inspection.created_at)}
                              </TableCell>
                              <TableCell>
                                <Link href={`/inspections/${inspection.id}`}>
                                  <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח בדיקה">
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Pagination
                      page={pagination.page}
                      pageSize={pagination.page_size}
                      total={pagination.total}
                      totalPages={pagination.total_pages}
                      onPageChange={setPage}
                      onPageSizeChange={handlePageSizeChange}
                      disabled={loading}
                    />
                  </>
                )}
              </CardBody>
            </Card>
          </>
        ) : (
          <Card className="overflow-hidden">
            <CardBody className="p-0">
              {plansLoading ? (
                <div className="divide-y divide-secondary-100">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                      <div className="h-7 w-16 rounded-md bg-secondary-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/4 rounded bg-secondary-100" />
                        <div className="h-3 w-1/3 rounded bg-secondary-50" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-secondary-100" />
                    </div>
                  ))}
                </div>
              ) : plans.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-secondary-100 flex items-center justify-center mx-auto">
                    <SlidersHorizontal className="h-7 w-7 text-secondary-400" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-secondary-900">לא נמצאו תוכניות בדיקה</h3>
                  <p className="text-sm text-secondary-500 mt-1">הגדר תוכנית כדי להפעיל בדיקות חוזרות באופן מסודר</p>
                  <Button className="mt-5" onClick={() => setShowCreatePlan(true)}>
                    <Plus className="h-4 w-4" />
                    תוכנית בדיקה חדשה
                  </Button>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead field="code" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          קוד
                        </SortableTableHead>
                        <SortableTableHead field="name" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          שם התוכנית
                        </SortableTableHead>
                        <SortableTableHead field="inspection_type" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          סוג
                        </SortableTableHead>
                        <SortableTableHead field="frequency" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          תדירות
                        </SortableTableHead>
                        <SortableTableHead field="sample_size" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          מדגם
                        </SortableTableHead>
                        <TableHead>מאפיינים</TableHead>
                        <TableHead>בדיקות</TableHead>
                        <SortableTableHead field="is_active" activeField={plansQuery.sortBy} direction={plansQuery.sortOrder} onSort={handlePlanSort}>
                          סטטוס
                        </SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                              {plan.code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-secondary-900 font-medium">{plan.name}</div>
                            <div className="text-xs text-secondary-400">
                              {[plan.product?.name, plan.site?.name].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-sm text-secondary-700">
                              <span className={cn('h-2 w-2 rounded-full', TYPE_DOTS[plan.inspection_type] || 'bg-secondary-300')} />
                              {TYPE_LABELS[plan.inspection_type] || plan.inspection_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">{FREQUENCY_LABELS[plan.frequency] || plan.frequency}</TableCell>
                          <TableCell>
                            <span className="inline-flex rounded-md border border-secondary-200 px-2 py-0.5 text-xs tabular-nums text-secondary-700">
                              {plan.sample_size}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {(plan.characteristics || []).slice(0, 3).map((c) => (
                                <span key={c} className="rounded-full bg-secondary-50 border border-secondary-200 px-2 py-0.5 text-xs text-secondary-600">
                                  {c}
                                </span>
                              ))}
                              {(plan.characteristics?.length || 0) > 3 && (
                                <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs text-secondary-500">
                                  +{plan.characteristics.length - 3}
                                </span>
                              )}
                              {!plan.characteristics?.length && <span className="text-secondary-300">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-secondary-900 tabular-nums">{plan.inspections_count}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.is_active ? 'success' : 'secondary'}>
                              {plan.is_active ? 'פעילה' : 'לא פעילה'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  page={plansPagination.page}
                  pageSize={plansPagination.page_size}
                  total={plansPagination.total}
                  totalPages={plansPagination.total_pages}
                  onPageChange={handlePlanPageChange}
                  onPageSizeChange={handlePlanPageSizeChange}
                  disabled={plansLoading}
                />
                </>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <CreateInspectionModal
        isOpen={showCreateInspection}
        onClose={() => setShowCreateInspection(false)}
        onCreated={async () => {
          setShowCreateInspection(false);
          toast.success('הבדיקה נוצרה בהצלחה');
          await refreshAll();
        }}
      />
      <CreatePlanModal
        isOpen={showCreatePlan}
        onClose={() => setShowCreatePlan(false)}
        onCreated={async () => {
          setShowCreatePlan(false);
          toast.success('תוכנית הבדיקה נוצרה בהצלחה');
          await refreshAll();
        }}
      />
    </MainLayout>
  );
}

function useRefOptions(isOpen: boolean) {
  const [products, setProducts] = useState<RefOption[]>([]);
  const [sites, setSites] = useState<RefOption[]>([]);
  const [plans, setPlans] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      sample_size: number;
      inspection_type: string;
      product_id?: string | null;
      site_id?: string | null;
    }>
  >([]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [productsRes, sitesRes, plansRes] = await Promise.all([
          api.getProducts({ page_size: 100 }),
          api.getSites({ page_size: 100 }),
          api.getInspectionPlans({ page_size: 100 }),
        ]);
        setProducts((productsRes.items || []).map((p: { id: string; sku: string; name: string }) => ({ id: p.id, label: `${p.sku} · ${p.name}` })));
        setSites((sitesRes.items || []).map((s: { id: string; code?: string | null; name: string }) => ({ id: s.id, label: s.code ? `${s.code} · ${s.name}` : s.name })));
        setPlans(plansRes.items || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isOpen]);

  return { products, sites, plans };
}

function CreateInspectionModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { products, sites, plans } = useRefOptions(isOpen);
  const [form, setForm] = useState({
    inspection_type: 'in_process',
    plan_id: '',
    product_id: '',
    site_id: '',
    lot_number: '',
    sample_size: '5',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setForm({ inspection_type: 'in_process', plan_id: '', product_id: '', site_id: '', lot_number: '', sample_size: '5', notes: '' });
      setError(null);
    }
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createInspection({
        inspection_type: form.inspection_type,
        plan_id: form.plan_id || null,
        product_id: form.product_id || null,
        site_id: form.site_id || null,
        lot_number: form.lot_number || null,
        sample_size: Number(form.sample_size) || 5,
        notes: form.notes || null,
      });
      await onCreated();
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת הבדיקה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="בדיקת איכות חדשה" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="סוג בדיקה *"
            value={form.inspection_type}
            onChange={(e) => setForm((p) => ({ ...p, inspection_type: e.target.value }))}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            required
          />
          <Input
            label="גודל מדגם *"
            type="number"
            min={1}
            max={1000}
            value={form.sample_size}
            onChange={(e) => setForm((p) => ({ ...p, sample_size: e.target.value }))}
            required
          />
        </div>

        <Select
          label="תוכנית בדיקה (אופציונלי)"
          value={form.plan_id}
          onChange={(e) => {
            const plan = plans.find((p) => p.id === e.target.value);
            setForm((prev) => ({
              ...prev,
              plan_id: e.target.value,
              ...(plan
                ? {
                    inspection_type: plan.inspection_type,
                    sample_size: String(plan.sample_size),
                    product_id: plan.product_id || prev.product_id,
                    site_id: plan.site_id || prev.site_id,
                  }
                : {}),
            }));
          }}
          options={plans.map((plan) => ({ value: plan.id, label: `${plan.code} · ${plan.name}` }))}
          placeholder="ללא תוכנית"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="מוצר"
            value={form.product_id}
            onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
            options={products.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="בחר מוצר"
          />
          <Select
            label="אתר / קו"
            value={form.site_id}
            onChange={(e) => setForm((p) => ({ ...p, site_id: e.target.value }))}
            options={sites.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="בחר אתר"
          />
        </div>

        <Input
          label="מספר אצווה"
          value={form.lot_number}
          onChange={(e) => setForm((p) => ({ ...p, lot_number: e.target.value }))}
          placeholder="LOT-2026-001"
        />

        <Textarea
          label="הערות"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="הערות לבדיקה"
        />

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button type="submit" loading={saving}>
            צור בדיקה
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreatePlanModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { products, sites } = useRefOptions(isOpen);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    inspection_type: 'in_process',
    frequency: 'per_lot',
    sample_size: '5',
    characteristics: '',
    product_id: '',
    site_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setForm({
        code: '',
        name: '',
        description: '',
        inspection_type: 'in_process',
        frequency: 'per_lot',
        sample_size: '5',
        characteristics: '',
        product_id: '',
        site_id: '',
      });
      setError(null);
    }
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createInspectionPlan({
        code: form.code,
        name: form.name,
        description: form.description || null,
        inspection_type: form.inspection_type,
        frequency: form.frequency,
        sample_size: Number(form.sample_size) || 5,
        characteristics: form.characteristics
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        product_id: form.product_id || null,
        site_id: form.site_id || null,
      });
      await onCreated();
    } catch (err: unknown) {
      console.error(err);
      const detail = (err as { response?: { data?: { error?: { message?: string }; detail?: string } } })?.response?.data;
      setError(detail?.error?.message || detail?.detail || 'שגיאה ביצירת תוכנית הבדיקה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="תוכנית בדיקה חדשה" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="קוד *"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            placeholder="IP-004"
            required
          />
          <div className="md:col-span-2">
            <Input
              label="שם התוכנית *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="בדיקת תהליך - קו 2"
              required
            />
          </div>
        </div>

        <Textarea
          label="תיאור"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="סוג בדיקה *"
            value={form.inspection_type}
            onChange={(e) => setForm((p) => ({ ...p, inspection_type: e.target.value }))}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            required
          />
          <Select
            label="תדירות *"
            value={form.frequency}
            onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
            options={Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))}
            required
          />
          <Input
            label="גודל מדגם *"
            type="number"
            min={1}
            max={1000}
            value={form.sample_size}
            onChange={(e) => setForm((p) => ({ ...p, sample_size: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="מוצר"
            value={form.product_id}
            onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
            options={products.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="בחר מוצר"
          />
          <Select
            label="אתר / קו"
            value={form.site_id}
            onChange={(e) => setForm((p) => ({ ...p, site_id: e.target.value }))}
            options={sites.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="בחר אתר"
          />
        </div>

        <Input
          label="מאפיינים (מופרדים בפסיק)"
          value={form.characteristics}
          onChange={(e) => setForm((p) => ({ ...p, characteristics: e.target.value }))}
          placeholder="משקל, מידות, צבע"
        />

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button type="submit" loading={saving}>
            צור תוכנית
          </Button>
        </div>
      </form>
    </Modal>
  );
}
