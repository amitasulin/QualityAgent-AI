'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
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
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CAPA {
  id: string;
  title: string;
  description: string;
  status: string;
  action_type: string;
  due_date: string;
  owner_id?: string;
  ncr_id: string;
  effectiveness_result?: boolean | null;
}

interface CapaStats {
  total: number;
  open: number;
  overdue: number;
  completed: number;
  rejected: number;
  effectiveness_check: number;
  pending_review: number;
}

interface Filters {
  status: string;
  search: string;
  page: number;
  page_size: number;
  overdue: boolean;
}

const statusOptions = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'assigned', label: 'הוקצה' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'pending_review', label: 'ממתין לבדיקה' },
  { value: 'effectiveness_check', label: 'בדיקת אפקטיביות' },
  { value: 'completed', label: 'הושלם' },
  { value: 'rejected', label: 'נדחה' },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
  correction: 'תיקון',
  corrective_action: 'פעולה מתקנת',
  preventive_action: 'פעולה מונעת',
};

export default function CorrectiveActionsPage() {
  const { isManager } = usePermissions();
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [stats, setStats] = useState<CapaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false, has_prev: false });
  const [filters, setFilters] = useState<Filters>({
    status: '',
    search: '',
    page: 1,
    page_size: 20,
    overdue: false,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  const fetchCapas = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.overdue) params.append('overdue', 'true');
      params.append('page', String(filters.page));
      params.append('page_size', String(filters.page_size));
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      const data = await api.getCorrectiveActions(Object.fromEntries(params));
      setCapas(data.items);
      setPagination({
        page: data.page,
        page_size: data.page_size,
        total: data.total,
        total_pages: data.total_pages,
        has_next: data.has_next ?? data.page < data.total_pages,
        has_prev: data.has_prev ?? data.page > 1,
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הפעולות המתקנות');
    } finally {
      setLoading(false);
    }
  }, [
    filters.status,
    filters.overdue,
    filters.page,
    filters.page_size,
    debouncedSearch,
    sortBy,
    sortOrder,
  ]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await api.getCorrectiveActionStats());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchCapas();
  }, [fetchCapas]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchCapas(), fetchStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateCAPA = async (formData: Record<string, unknown>) => {
    try {
      await api.createCorrectiveAction(formData);
      toast.success('הפעולה המתקנת נוצרה בהצלחה');
      setShowCreateModal(false);
      await refreshAll();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'יצירת הפעולה המתקנת נכשלה'));
      throw err;
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setFilters((prev) => ({ ...prev, page_size: pageSize, page: 1 }));
  };

  const handleSort = (field: string) => {
    setFilters((prev) => ({ ...prev, page: 1 }));
    setSortBy(field);
    setSortOrder((prev) => (sortBy === field && prev === 'asc' ? 'desc' : 'asc'));
  };

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getDueDateStatus = (dueDate: string, status: string) => {
    if (['completed', 'rejected'].includes(status)) return 'normal';
    const days = getDaysRemaining(dueDate);
    if (days < 0) return 'overdue';
    if (days <= 2) return 'urgent';
    if (days <= 5) return 'warning';
    return 'normal';
  };

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.overdue);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={ShieldCheck}
          tone="warning"
          title="פעולות מתקנות (CAPA)"
          badge={<Badge variant="warning">{stats?.total ?? pagination.total} פעולות</Badge>}
          subtitle="ניהול ומעקב אחר פעולות מתקנות ומונעות, מועדי יעד ובדיקות אפקטיביות"
          actions={
            <>
              <Button variant="secondary" onClick={refreshAll} loading={refreshing}>
                {!refreshing && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
              {isManager && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" />
                  פעולה מתקנת חדשה
                </Button>
              )}
            </>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="פעולות פתוחות"
            value={stats?.open ?? '—'}
            hint={stats ? `מתוך ${stats.total} פעולות במערכת` : undefined}
            icon={AlertCircle}
            tone="primary"
          />
          <KpiCard
            label="באיחור"
            value={stats?.overdue ?? '—'}
            hint={(stats?.overdue ?? 0) > 0 ? 'דורש טיפול מיידי' : 'אין פעולות באיחור'}
            icon={Clock}
            tone="danger"
          />
          <KpiCard
            label="הושלמו"
            value={stats?.completed ?? '—'}
            hint={stats && stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% מכלל הפעולות` : undefined}
            icon={CheckCircle2}
            tone="success"
            progress={stats && stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
          />
          <KpiCard
            label="ממתינות לאפקטיביות"
            value={stats?.effectiveness_check ?? '—'}
            hint={stats ? `${stats.pending_review} ממתינות לבדיקה` : undefined}
            icon={ShieldCheck}
            tone="warning"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="חיפוש בכותרת או תיאור..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pr-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  options={statusOptions}
                  className="w-44"
                />
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-secondary-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filters.overdue}
                    onChange={(e) => handleFilterChange('overdue', e.target.checked)}
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-600">רק באיחור</span>
                </label>
                <Button
                  variant="ghost"
                  onClick={() => setFilters({ ...filters, status: '', search: '', overdue: false, page: 1 })}
                >
                  <Filter className="h-4 w-4" />
                  איפוס
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* CAPA table */}
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            {loading ? (
              <div className="divide-y divide-secondary-100">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 rounded bg-secondary-100" />
                      <div className="h-3 w-1/4 rounded bg-secondary-50" />
                    </div>
                    <div className="h-6 w-20 rounded-full bg-secondary-100" />
                    <div className="h-6 w-16 rounded-full bg-secondary-50" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertCircle className="h-10 w-10 text-danger-500 mx-auto" />
                <p className="mt-3 text-danger-600">{error}</p>
                <Button variant="secondary" className="mt-4" onClick={refreshAll}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : capas.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={hasActiveFilters ? 'לא נמצאו פעולות מתקנות' : 'לא נרשמו פעולות מתקנות'}
                description={
                  hasActiveFilters
                    ? 'נסה לשנות את הסינון או לאפס אותו'
                    : 'צור פעולה מתקנת כדי לתכנן ולעקוב אחר הטיפול בחריגה'
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="secondary"
                      onClick={() => setFilters({ ...filters, status: '', search: '', overdue: false, page: 1 })}
                    >
                      <Filter className="h-4 w-4" />
                      איפוס סינון
                    </Button>
                  ) : isManager ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      פעולה מתקנת חדשה
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead field="title" activeField={sortBy} direction={sortOrder} onSort={handleSort}>
                          כותרת
                        </SortableTableHead>
                        <SortableTableHead field="action_type" activeField={sortBy} direction={sortOrder} onSort={handleSort} className="w-28">
                          סוג
                        </SortableTableHead>
                        <SortableTableHead field="status" activeField={sortBy} direction={sortOrder} onSort={handleSort} className="w-32">
                          סטטוס
                        </SortableTableHead>
                        <SortableTableHead field="due_date" activeField={sortBy} direction={sortOrder} onSort={handleSort} className="w-32">
                          תאריך יעד
                        </SortableTableHead>
                        <TableHead className="w-32">נותרו</TableHead>
                        <SortableTableHead field="effectiveness_check_date" activeField={sortBy} direction={sortOrder} onSort={handleSort} className="w-32">
                          אפקטיביות
                        </SortableTableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capas.map((capa) => {
                        const dueStatus = getDueDateStatus(capa.due_date, capa.status);
                        const daysRemaining = getDaysRemaining(capa.due_date);
                        const isOverdue = dueStatus === 'overdue';
                        return (
                          <TableRow
                            key={capa.id}
                            className={cn('group cursor-pointer', isOverdue && 'bg-danger-50/50')}
                          >
                            <TableCell className="max-w-[320px]">
                              <Link href={`/corrective-actions/${capa.id}`} className="block">
                                <div className="flex items-center gap-2">
                                  {isOverdue && <span className="h-2 w-2 rounded-full bg-danger-500 shrink-0" />}
                                  <span className="text-secondary-900 font-medium truncate group-hover:text-primary-700">
                                    {capa.title}
                                  </span>
                                </div>
                                <div className="text-xs text-secondary-400 truncate mt-0.5">
                                  {capa.description || '—'}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ACTION_TYPE_LABELS[capa.action_type] || capa.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={capa.status} type="capa" />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-secondary-500 whitespace-nowrap">
                              {formatDate(capa.due_date)}
                            </TableCell>
                            <TableCell>
                              {['completed', 'rejected'].includes(capa.status) ? (
                                <span className="text-xs text-secondary-400">הושלם</span>
                              ) : (
                                <Badge
                                  variant={
                                    isOverdue
                                      ? 'danger'
                                      : dueStatus === 'urgent'
                                        ? 'danger'
                                        : dueStatus === 'warning'
                                          ? 'warning'
                                          : 'secondary'
                                  }
                                >
                                  {daysRemaining < 0
                                    ? `${Math.abs(daysRemaining)} ימי איחור`
                                    : daysRemaining === 0
                                      ? 'היום'
                                      : `${daysRemaining} ימים`}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {capa.effectiveness_result === null || capa.effectiveness_result === undefined ? (
                                <span className="text-xs text-secondary-400">טרם נבדק</span>
                              ) : (
                                <Badge variant={capa.effectiveness_result ? 'success' : 'danger'}>
                                  {capa.effectiveness_result ? 'אפקטיבי' : 'לא אפקטיבי'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Link href={`/corrective-actions/${capa.id}`}>
                                <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח פעולה">
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Pagination
                  page={pagination.page}
                  pageSize={pagination.page_size}
                  total={pagination.total}
                  totalPages={pagination.total_pages}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  disabled={loading}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CreateCAPAModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCAPA}
      />
    </MainLayout>
  );
}

function CreateCAPAModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    action_type: 'corrective_action',
    ncr_id: '',
    due_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ncrs, setNcrs] = useState<Array<{ id: string; number: string; title: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await api.getNonconformities({ page_size: 100 });
        setNcrs(res.items || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת הפעולה המתקנת');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="פעולה מתקנת חדשה (CAPA)" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="כותרת *"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          placeholder="תיאור קצר של הפעולה"
        />

        <Textarea
          label="תיאור מלא *"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          rows={4}
          placeholder="מה יבוצע, על ידי מי, וכיצד יימדד"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="סוג פעולה *"
            name="action_type"
            value={formData.action_type}
            onChange={handleChange}
            required
            options={[
              { value: 'correction', label: 'תיקון' },
              { value: 'corrective_action', label: 'פעולה מתקנת' },
              { value: 'preventive_action', label: 'פעולה מונעת' },
            ]}
          />
          <Input
            label="תאריך יעד *"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
            required
          />
        </div>

        <Select
          label="חריגה מקושרת (NCR) *"
          name="ncr_id"
          value={formData.ncr_id}
          onChange={handleChange}
          required
          options={ncrs.map((n) => ({ value: n.id, label: `${n.number} - ${n.title}` }))}
          placeholder="בחר חריגה"
        />

        {error && (
          <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            ביטול
          </Button>
          <Button type="submit" loading={loading}>
            צור פעולה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
