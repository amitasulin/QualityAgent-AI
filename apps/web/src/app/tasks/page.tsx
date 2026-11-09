'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Clock3,
  Filter,
  Plus,
  RefreshCw,
  Search,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
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
import { ConfirmDialog } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import type { FieldDef, FormValues } from '@/components/master-data/EntityFormFields';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatDate } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  task_type?: string | null;
  status: string;
  priority: string;
  assignee_id?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

interface UserOption {
  id: string;
  full_name: string;
}

interface Filters {
  status: string;
  priority: string;
  assignee_id: string;
  search: string;
  my_tasks: boolean;
  overdue: boolean;
  page: number;
  page_size: number;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

const DEFAULT_FILTERS: Filters = {
  status: '',
  priority: '',
  assignee_id: '',
  search: '',
  my_tasks: false,
  overdue: false,
  page: 1,
  page_size: 20,
  sort_by: 'due_date',
  sort_order: 'asc',
};

const statusOptions = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'todo', label: 'לביצוע' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'review', label: 'לסקירה' },
  { value: 'done', label: 'בוצע' },
  { value: 'cancelled', label: 'בוטל' },
];

const priorityOptions = [
  { value: '', label: 'כל העדיפויות' },
  { value: 'urgent', label: 'דחוף' },
  { value: 'high', label: 'גבוה' },
  { value: 'medium', label: 'בינוני' },
  { value: 'low', label: 'נמוך' },
];

const typeLabels: Record<string, string> = {
  ncr_review: 'סקירת חריגה',
  capa_action: 'פעולה מתקנת',
  document_review: 'סקירת מסמך',
  audit: 'ביקורת',
  custom: 'אחר',
};

const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }));

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.due_date).getTime() < Date.now();
}

function DueDateCell({ task }: { task: Task }) {
  if (!task.due_date) return <span className="text-secondary-300">—</span>;

  if (task.status === 'done' || task.status === 'cancelled') {
    return <span className="text-sm text-secondary-500 whitespace-nowrap">{formatDate(task.due_date)}</span>;
  }

  if (isOverdue(task)) {
    const days = Math.abs(
      Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600 whitespace-nowrap">
        <Clock3 className="h-3 w-3" />
        באיחור {days} ימים
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-600 whitespace-nowrap">
      <CalendarClock className="h-3 w-3" />
      {formatDate(task.due_date)}
    </span>
  );
}

export default function TasksPage() {
  const { canCreateTask, canEditTask, canCompleteTask } = usePermissions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [stats, setStats] = useState({ total: 0, todo: 0, overdue: 0, done: 0 });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Task | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters((prev) => ({
      ...prev,
      status: params.get('status') ?? '',
      overdue: params.get('overdue') === 'true',
      my_tasks: params.get('my_tasks') === 'true',
    }));
    setReady(true);
  }, []);

  useEffect(() => {
    api
      .getUsers({ page: 1, page_size: 100 })
      .then((data) => setUsers(data.items || []))
      .catch((err) => console.error(err));
  }, []);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.id, user.full_name);
    return map;
  }, [users]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: filters.page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.assignee_id) params.assignee_id = filters.assignee_id;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (filters.my_tasks) params.my_tasks = true;
      if (filters.overdue) params.overdue = true;

      const data = await api.getTasks(params);
      setTasks(data.items || []);
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
      setError('שגיאה בטעינת המשימות');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getTaskStats();
      setStats({
        total: data.total || 0,
        todo: data.todo || 0,
        overdue: data.overdue || 0,
        done: data.done || 0,
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (ready) fetchTasks();
  }, [ready, fetchTasks]);

  useEffect(() => {
    if (ready) fetchStats();
  }, [ready, fetchStats]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchTasks(), fetchStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string | boolean | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSort = (field: string) => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.priority ||
      filters.assignee_id ||
      filters.search ||
      filters.my_tasks ||
      filters.overdue
  );

  const handleCreate = async (payload: Record<string, unknown>) => {
    if (typeof payload.due_date === 'string' && payload.due_date) {
      payload.due_date = new Date(payload.due_date).toISOString();
    }
    await api.createTask(payload);
    toast.success('המשימה נוצרה בהצלחה');
    await refreshAll();
  };

  const handleComplete = async (task: Task) => {
    setCompletingId(task.id);
    try {
      await api.completeTask(task.id);
      toast.success(`"${task.title}" סומנה כהושלמה`);
      await refreshAll();
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'סימון המשימה כהושלמה נכשל'));
    } finally {
      setCompletingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.updateTask(cancelTarget.id, { status: 'cancelled' });
      toast.success('המשימה בוטלה');
      setCancelTarget(null);
      await refreshAll();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'ביטול המשימה נכשל'));
    } finally {
      setCancelling(false);
    }
  };

  const createFields: FieldDef[] = [
    {
      name: 'title',
      label: 'כותרת המשימה *',
      required: true,
      fullWidth: true,
      placeholder: 'למשל: סקירת חריגה NCR-1042',
    },
    {
      name: 'description',
      label: 'תיאור',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      placeholder: 'פירוט המשימה והצעדים הנדרשים',
    },
    { name: 'task_type', label: 'סוג משימה', type: 'select', options: typeOptions },
    { name: 'priority', label: 'עדיפות', type: 'select', options: priorityOptions.filter((o) => o.value) },
    {
      name: 'assignee_id',
      label: 'אחראי ביצוע',
      type: 'select',
      options: users.map((u) => ({ value: u.id, label: u.full_name })),
      placeholder: 'ללא שיוך',
    },
    { name: 'due_date', label: 'תאריך יעד', type: 'datetime-local' },
  ];

  const createInitial: FormValues = {
    title: '',
    description: '',
    task_type: 'custom',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={CheckSquare}
          title="משימות"
          badge={<Badge variant="primary">{stats.total} משימות</Badge>}
          subtitle="מעקב אחר משימות איכות, שיוך אחראים ועמידה בתאריכי יעד"
          actions={
            <>
              <Button variant="secondary" onClick={refreshAll} loading={refreshing}>
                {!refreshing && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
              {canCreateTask && (
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  משימה חדשה
                </Button>
              )}
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="סה״כ משימות"
            value={stats.total}
            hint="כל המשימות במערכת"
            icon={CheckSquare}
            tone="primary"
          />
          <KpiCard
            label="לביצוע"
            value={stats.todo}
            hint="משימות שטרם החלו"
            icon={CalendarClock}
            tone="secondary"
          />
          <KpiCard
            label="באיחור"
            value={stats.overdue}
            hint={stats.overdue > 0 ? 'נדרשת התערבות' : 'אין משימות באיחור'}
            icon={Clock3}
            tone={stats.overdue > 0 ? 'danger' : 'success'}
          />
          <KpiCard
            label="הושלמו"
            value={stats.done}
            hint="משימות שהושלמו בהצלחה"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="חיפוש בכותרת או בתיאור..."
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
                  className="w-40"
                />
                <Select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  options={priorityOptions}
                  className="w-40"
                />
                <Select
                  value={filters.assignee_id}
                  onChange={(e) => handleFilterChange('assignee_id', e.target.value)}
                  options={users.map((u) => ({ value: u.id, label: u.full_name }))}
                  placeholder="כל האחראים"
                  className="w-44"
                />
                <Button
                  variant={filters.my_tasks ? 'primary' : 'ghost'}
                  onClick={() => handleFilterChange('my_tasks', !filters.my_tasks)}
                >
                  <UserIcon className="h-4 w-4" />
                  המשימות שלי
                </Button>
                <Button
                  variant={filters.overdue ? 'primary' : 'ghost'}
                  onClick={() => handleFilterChange('overdue', !filters.overdue)}
                >
                  <Clock3 className="h-4 w-4" />
                  באיחור
                </Button>
                <Button variant="ghost" onClick={resetFilters}>
                  <Filter className="h-4 w-4" />
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
                    <div className="h-3.5 w-20 rounded bg-secondary-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 rounded bg-secondary-100" />
                      <div className="h-3 w-1/4 rounded bg-secondary-50" />
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
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={hasActiveFilters ? 'לא נמצאו משימות תואמות' : 'אין משימות עדיין'}
                description={
                  hasActiveFilters
                    ? 'נסה לשנות את הסינון או לאפס אותו'
                    : 'צור משימה חדשה כדי להתחיל לעקוב אחר ביצוע'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={resetFilters}>
                      <Filter className="h-4 w-4" />
                      איפוס סינון
                    </Button>
                  ) : (
                    canCreateTask && (
                      <Button onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" />
                        משימה חדשה
                      </Button>
                    )
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          field="title"
                          activeField={filters.sort_by}
                          direction={filters.sort_order}
                          onSort={handleSort}
                        >
                          משימה
                        </SortableTableHead>
                        <TableHead className="w-32">סוג</TableHead>
                        <SortableTableHead
                          field="status"
                          activeField={filters.sort_by}
                          direction={filters.sort_order}
                          onSort={handleSort}
                          className="w-28"
                        >
                          סטטוס
                        </SortableTableHead>
                        <SortableTableHead
                          field="priority"
                          activeField={filters.sort_by}
                          direction={filters.sort_order}
                          onSort={handleSort}
                          className="w-24"
                        >
                          עדיפות
                        </SortableTableHead>
                        <TableHead className="w-40">אחראי</TableHead>
                        <SortableTableHead
                          field="due_date"
                          activeField={filters.sort_by}
                          direction={filters.sort_order}
                          onSort={handleSort}
                          className="w-36"
                        >
                          תאריך יעד
                        </SortableTableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow key={task.id} className="group">
                          <TableCell className="max-w-[340px]">
                            <Link href={`/tasks/${task.id}`} className="block">
                              <div className="font-medium text-secondary-900 group-hover:text-primary-700 truncate">
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="text-xs text-secondary-400 truncate mt-0.5">
                                  {task.description}
                                </div>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {task.task_type ? typeLabels[task.task_type] || task.task_type : '—'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={task.status} type="task" />
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={task.priority} />
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">
                            {task.assignee_id ? userMap.get(task.assignee_id) || '—' : '—'}
                          </TableCell>
                          <TableCell>
                            <DueDateCell task={task} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {task.status !== 'done' &&
                                task.status !== 'cancelled' &&
                                canCompleteTask(task) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleComplete(task)}
                                    loading={completingId === task.id}
                                    className="text-success-600 hover:bg-success-50"
                                    title="סמן כהושלמה"
                                  >
                                    {completingId !== task.id && <CheckCircle2 className="h-4 w-4" />}
                                  </Button>
                                )}
                              {task.status !== 'done' &&
                                task.status !== 'cancelled' &&
                                canEditTask(task) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCancelTarget(task)}
                                    className="text-secondary-400 hover:bg-danger-50 hover:text-danger-600"
                                    title="בטל משימה"
                                    aria-label={`בטל את ${task.title}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              <Link href={`/tasks/${task.id}`}>
                                <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח משימה">
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
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
                  onPageChange={(page) => handleFilterChange('page', page)}
                  onPageSizeChange={(pageSize) => handleFilterChange('page_size', pageSize)}
                  disabled={loading}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CreateEntityModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="משימה חדשה"
        description="הגדר כותרת, אחראי ותאריך יעד — שאר השדות אופציונליים"
        fields={createFields}
        initialValues={createInitial}
        submitLabel="צור משימה"
        errorFallback="יצירת המשימה נכשלה"
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
        variant="danger"
        title="ביטול משימה"
        message={`לבטל את "${cancelTarget?.title ?? ''}"? המשימה תסומן כמבוטלת ותישאר בהיסטוריה.`}
        confirmText="בטל משימה"
      />
    </MainLayout>
  );
}
