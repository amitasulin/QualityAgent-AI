'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Flame,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { formatRelativeTime, formatDate, cn } from '@/lib/utils';

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
  resolved_at?: string | null;
  closed_at?: string | null;
  satisfaction_rating?: number | null;
  customer?: { id: string; code: string; name: string } | null;
  product?: { id: string; sku: string; name: string } | null;
  assigned_to?: { id: string; full_name: string } | null;
  ncr?: { id: string; number: string } | null;
}

interface ComplaintStats {
  total: number;
  new: number;
  under_review: number;
  investigating: number;
  action_pending: number;
  resolved: number;
  closed: number;
  rejected: number;
  open: number;
  critical: number;
  major: number;
  high_severity: number;
  overdue: number;
  avg_satisfaction: number;
  avg_resolution_days: number;
}

interface Filters {
  status: string;
  severity: string;
  overdue: string;
  search: string;
  page: number;
  page_size: number;
}

const statusOptions = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'new', label: 'חדשה' },
  { value: 'under_review', label: 'בבדיקה' },
  { value: 'investigating', label: 'בחקירה' },
  { value: 'action_pending', label: 'ממתין לפעולה' },
  { value: 'resolved', label: 'טופלה' },
  { value: 'closed', label: 'סגורה' },
  { value: 'rejected', label: 'נדחתה' },
];

const severityOptions = [
  { value: '', label: 'כל החומרות' },
  { value: 'critical', label: 'קריטי' },
  { value: 'major', label: 'חמור' },
  { value: 'minor', label: 'קל' },
  { value: 'observation', label: 'הערה' },
];

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function SlaCell({ dueDate, status }: { dueDate?: string | null; status: string }) {
  if (!dueDate) return <span className="text-secondary-300">—</span>;
  const done = ['resolved', 'closed', 'rejected'].includes(status);
  const days = daysUntil(dueDate);
  if (done) {
    return <span className="text-xs text-secondary-400">{formatDate(dueDate)}</span>;
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
        <Clock3 className="h-3 w-3" />
        באיחור {Math.abs(days)} ימים
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        days <= 2 ? 'bg-warning-50 text-warning-600' : 'bg-secondary-100 text-secondary-600'
      )}
    >
      <Clock3 className="h-3 w-3" />
      {days === 0 ? 'היום' : `בעוד ${days} ימים`}
    </span>
  );
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false, has_prev: false });
  const [filters, setFilters] = useState<Filters>({
    status: '',
    severity: '',
    overdue: '',
    search: '',
    page: 1,
    page_size: 20,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      const data = await api.getComplaints(Object.fromEntries(params));
      setComplaints(data.items);
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
      setError('שגיאה בטעינת התלונות');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await api.getComplaintStats());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchComplaints(), fetchStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const resetFilters = () =>
    setFilters((prev) => ({ ...prev, status: '', severity: '', overdue: '', search: '', page: 1 }));

  const handleCreate = async (formData: Record<string, unknown>) => {
    await api.createComplaint(formData);
    setShowCreateModal(false);
    await refreshAll();
  };

  const handleExport = () => {
    const header = ['מספר', 'כותרת', 'לקוח', 'סטטוס', 'חומרה', 'אצווה', 'התקבלה', 'יעד'];
    const rows = complaints.map((c) => [
      c.number,
      c.title,
      c.customer?.name || '',
      c.status,
      c.severity,
      c.lot_number || '',
      c.received_at,
      c.due_date || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'complaints.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.severity || filters.overdue);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={MessageSquareWarning}
          tone="warning"
          title="תלונות לקוח"
          badge={<Badge variant="warning">{stats?.total ?? pagination.total} תלונות</Badge>}
          subtitle="קליטה, חקירה ומעקב אחר תלונות לקוחות וזמני תגובה"
          actions={
            <>
              <Button variant="secondary" onClick={refreshAll} loading={refreshing}>
                {!refreshing && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" />
                תלונה חדשה
              </Button>
            </>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="תלונות פתוחות"
            value={stats?.open ?? '—'}
            hint={stats ? `${stats.new} חדשות · ${stats.investigating} בחקירה` : undefined}
            icon={MessageSquareWarning}
            tone="primary"
            progress={stats && stats.total > 0 ? (stats.open / stats.total) * 100 : 0}
          />
          <KpiCard
            label="חומרה גבוהה"
            value={stats?.high_severity ?? '—'}
            hint={stats ? `${stats.critical} קריטיות · ${stats.major} חמורות` : undefined}
            icon={Flame}
            tone="danger"
          />
          <KpiCard
            label="חריגות SLA"
            value={stats?.overdue ?? '—'}
            hint={stats ? 'תלונות שעברו את תאריך היעד' : undefined}
            icon={Clock3}
            tone="warning"
          />
          <KpiCard
            label="שביעות רצון"
            value={stats ? stats.avg_satisfaction.toFixed(1) : '—'}
            hint={stats ? `זמן טיפול ממוצע: ${stats.avg_resolution_days} ימים` : undefined}
            icon={Star}
            tone="success"
            progress={stats ? (stats.avg_satisfaction / 5) * 100 : 0}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="חיפוש במספר, כותרת, לקוח או אצווה..."
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
                <Select
                  value={filters.severity}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  options={severityOptions}
                  className="w-40"
                />
                <Button
                  variant={filters.overdue ? 'primary' : 'ghost'}
                  onClick={() => handleFilterChange('overdue', filters.overdue ? '' : 'true')}
                >
                  <Clock3 className="h-4 w-4" />
                  חריגות SLA
                </Button>
                <Button variant="ghost" onClick={resetFilters}>
                  <Filter className="h-4 w-4" />
                  איפוס
                </Button>
                <Button variant="secondary" onClick={handleExport} disabled={loading || complaints.length === 0}>
                  <Download className="h-4 w-4" />
                  ייצוא
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Complaints table */}
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
            ) : complaints.length === 0 ? (
              <EmptyState
                icon={MessageSquareWarning}
                title={hasActiveFilters ? 'לא נמצאו תלונות תואמות' : 'לא נרשמו תלונות'}
                description={
                  hasActiveFilters
                    ? 'נסה לשנות את הסינון או לאפס אותו'
                    : 'קלוט תלונה חדשה כדי לפתוח תהליך טיפול ומעקב'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={resetFilters}>
                      <Filter className="h-4 w-4" />
                      איפוס סינון
                    </Button>
                  ) : (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      תלונה חדשה
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">מספר</TableHead>
                        <TableHead>כותרת</TableHead>
                        <TableHead className="w-28">סטטוס</TableHead>
                        <TableHead className="w-24">חומרה</TableHead>
                        <TableHead className="w-32">יעד SLA</TableHead>
                        <TableHead className="hidden xl:table-cell w-28">התקבלה</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complaints.map((complaint) => (
                        <TableRow key={complaint.id} className="group cursor-pointer">
                          <TableCell className="whitespace-nowrap">
                            <Link
                              href={`/complaints/${complaint.id}`}
                              className="font-mono text-sm font-semibold text-secondary-900 group-hover:text-primary-700"
                            >
                              {complaint.number}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <Link href={`/complaints/${complaint.id}`} className="block">
                              <div className="text-secondary-900 font-medium truncate" title={complaint.title}>
                                {complaint.title}
                              </div>
                              <div className="text-xs text-secondary-400 truncate mt-0.5">
                                {complaint.customer?.name || 'לקוח לא צוין'}
                                {complaint.lot_number ? ` · אצווה ${complaint.lot_number}` : ''}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={complaint.status} type="complaint" />
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={complaint.severity} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SlaCell dueDate={complaint.due_date} status={complaint.status} />
                          </TableCell>
                          <TableCell className="hidden xl:table-cell whitespace-nowrap">
                            <div
                              className="text-sm text-secondary-600"
                              title={formatDate(complaint.received_at)}
                            >
                              {formatRelativeTime(complaint.received_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/complaints/${complaint.id}`}>
                              <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח תלונה">
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 bg-secondary-50/50">
                    <p className="text-sm text-secondary-500">
                      מציג {(pagination.page - 1) * pagination.page_size + 1}–
                      {Math.min(pagination.page * pagination.page_size, pagination.total)} מתוך {pagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFilterChange('page', String(pagination.page - 1))}
                        disabled={!pagination.has_prev}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFilterChange('page', String(pagination.page + 1))}
                        disabled={!pagination.has_next}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CreateComplaintModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />
    </MainLayout>
  );
}

function CreateComplaintModal({
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
    severity: 'minor',
    customer_id: '',
    product_id: '',
    lot_number: '',
    customer_reference: '',
    due_date: '',
    assigned_to_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; sku: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen]);

  const fetchOptions = async () => {
    try {
      const [customersRes, productsRes, usersRes] = await Promise.all([
        api.getCustomers({ page_size: 100 }),
        api.getProducts({ page_size: 100 }),
        api.getUsers({ page_size: 100 }),
      ]);
      setCustomers(customersRes.items);
      setProducts(productsRes.items);
      setUsers(usersRes.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value) payload[key] = value;
      });
      await onSubmit(payload);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת התלונה');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="קליטת תלונת לקוח חדשה" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="כותרת *"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="תיאור קצר של התלונה"
          />
          <Select
            label="חומרה *"
            name="severity"
            value={formData.severity}
            onChange={handleChange}
            options={severityOptions.filter((o) => o.value)}
            required
          />
        </div>

        <Textarea
          label="תיאור מלא *"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          rows={4}
          placeholder="תיאור מפורט של התלונה כפי שהתקבלה מהלקוח"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="לקוח"
            name="customer_id"
            value={formData.customer_id}
            onChange={handleChange}
            options={customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
            placeholder="בחר לקוח"
          />
          <Select
            label="מוצר"
            name="product_id"
            value={formData.product_id}
            onChange={handleChange}
            options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            placeholder="בחר מוצר"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="אצווה"
            name="lot_number"
            value={formData.lot_number}
            onChange={handleChange}
            placeholder="LOT-2026-XXX"
          />
          <Input
            label="אסמכתת לקוח"
            name="customer_reference"
            value={formData.customer_reference}
            onChange={handleChange}
            placeholder="REF-1234"
          />
          <Input
            label="תאריך יעד"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
          />
        </div>

        <Select
          label="אחראי טיפול"
          name="assigned_to_id"
          value={formData.assigned_to_id}
          onChange={handleChange}
          options={users.map((u) => ({ value: u.id, label: u.full_name }))}
          placeholder="שיוך אוטומטי אליי"
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
            קלוט תלונה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
