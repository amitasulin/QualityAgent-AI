'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Flame,
  Plus,
  RefreshCw,
  Search,
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
import { formatRelativeTime, formatDate } from '@/lib/utils';

interface NCR {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  product_id?: string;
  site_id?: string;
  lot_number?: string;
  defect_code?: string;
  detected_at: string;
  detected_by_id?: string;
}

interface NcrStats {
  total: number;
  open: number;
  closed: number;
  investigating: number;
  action_pending: number;
  reopened: number;
  critical: number;
  major: number;
  high_severity: number;
}

interface Filters {
  status: string;
  severity: string;
  search: string;
  page: number;
  page_size: number;
}

const statusOptions = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'open', label: 'פתוח' },
  { value: 'contained', label: 'מבודד' },
  { value: 'investigating', label: 'בחקירה' },
  { value: 'action_pending', label: 'ממתין לפעולה' },
  { value: 'effectiveness_review', label: 'בדיקת אפקטיביות' },
  { value: 'closed', label: 'סגור' },
  { value: 'reopened', label: 'נפתח מחדש' },
];

const severityOptions = [
  { value: '', label: 'כל החומרות' },
  { value: 'critical', label: 'קריטי' },
  { value: 'major', label: 'חמור' },
  { value: 'minor', label: 'קל' },
  { value: 'observation', label: 'הערה' },
];

export default function NonconformitiesPage() {
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [stats, setStats] = useState<NcrStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false, has_prev: false });
  const [filters, setFilters] = useState<Filters>({
    status: '',
    severity: '',
    search: '',
    page: 1,
    page_size: 20,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchNcrs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      const data = await api.getNonconformities(Object.fromEntries(params));
      setNcrs(data.items);
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
      setError('שגיאה בטעינת החריגות');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await api.getNonconformityStats());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchNcrs();
  }, [fetchNcrs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchNcrs(), fetchStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleCreateNCR = async (formData: Record<string, unknown>) => {
    await api.createNonconformity(formData);
    setShowCreateModal(false);
    await refreshAll();
  };

  const handleExport = () => {
    const header = ['מספר', 'כותרת', 'סטטוס', 'חומרה', 'אצווה', 'קוד פגם', 'תאריך זיהוי'];
    const rows = ncrs.map((n) => [
      n.number,
      n.title,
      n.status,
      n.severity,
      n.lot_number || '',
      n.defect_code || '',
      n.detected_at,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nonconformities.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.severity);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={AlertTriangle}
          tone="danger"
          title="ניהול אי התאמות"
          badge={<Badge variant="danger">{stats?.total ?? pagination.total} חריגות</Badge>}
          subtitle="צפייה, יצירה וניהול חריגות איכות (NCR) ומעקב אחר סטטוס הטיפול"
          actions={
            <>
              <Button variant="secondary" onClick={refreshAll} loading={refreshing}>
                {!refreshing && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" />
                חריגה חדשה
              </Button>
            </>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="חריגות פתוחות"
            value={stats?.open ?? '—'}
            hint={stats ? `מתוך ${stats.total} חריגות במערכת` : undefined}
            icon={AlertTriangle}
            tone="danger"
          />
          <KpiCard
            label="חומרה גבוהה"
            value={stats?.high_severity ?? '—'}
            hint={stats ? `${stats.critical} קריטיות · ${stats.major} חמורות` : undefined}
            icon={Flame}
            tone="warning"
          />
          <KpiCard
            label="בחקירה פעילה"
            value={stats?.investigating ?? '—'}
            hint={stats ? `${stats.action_pending} ממתינות לפעולה` : undefined}
            icon={Search}
            tone="primary"
          />
          <KpiCard
            label="סגורות"
            value={stats?.closed ?? '—'}
            hint={stats && stats.total > 0 ? `${Math.round((stats.closed / stats.total) * 100)}% מכלל החריגות` : undefined}
            icon={CheckCircle2}
            tone="success"
            progress={stats && stats.total > 0 ? (stats.closed / stats.total) * 100 : 0}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="חיפוש במספר, כותרת או תיאור..."
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
                  variant="ghost"
                  onClick={() => setFilters({ ...filters, status: '', severity: '', search: '', page: 1 })}
                >
                  <Filter className="h-4 w-4" />
                  איפוס
                </Button>
                <Button variant="secondary" onClick={handleExport} disabled={loading || ncrs.length === 0}>
                  <Download className="h-4 w-4" />
                  ייצוא
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* NCR table */}
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
            ) : ncrs.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title={hasActiveFilters ? 'לא נמצאו חריגות תואמות' : 'לא נרשמו חריגות'}
                description={
                  hasActiveFilters
                    ? 'נסה לשנות את הסינון או לאפס אותו'
                    : 'דווח על חריגה חדשה כדי לפתוח תהליך טיפול וניתוח שורש'
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="secondary"
                      onClick={() => setFilters({ ...filters, status: '', severity: '', search: '', page: 1 })}
                    >
                      <Filter className="h-4 w-4" />
                      איפוס סינון
                    </Button>
                  ) : (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      חריגה חדשה
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
                        <TableHead className="w-32">מספר</TableHead>
                        <TableHead>כותרת</TableHead>
                        <TableHead className="w-32">סטטוס</TableHead>
                        <TableHead className="w-24">חומרה</TableHead>
                        <TableHead className="w-28">אצווה</TableHead>
                        <TableHead className="hidden xl:table-cell w-28">פגם</TableHead>
                        <TableHead className="w-32">זוהה</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ncrs.map((ncr) => (
                        <TableRow key={ncr.id} className="group cursor-pointer">
                          <TableCell className="whitespace-nowrap">
                            <Link
                              href={`/nonconformities/${ncr.id}`}
                              className="font-mono text-sm font-semibold text-secondary-900 group-hover:text-primary-700"
                            >
                              {ncr.number}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <Link href={`/nonconformities/${ncr.id}`} className="block">
                              <div className="text-secondary-900 font-medium truncate" title={ncr.title}>
                                {ncr.title}
                              </div>
                              <div className="text-xs text-secondary-400 truncate mt-0.5">
                                {ncr.description || '—'}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ncr.status} type="ncr" />
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={ncr.severity} />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-secondary-500">
                            {ncr.lot_number || '—'}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {ncr.defect_code ? (
                              <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-medium text-secondary-700">
                                {ncr.defect_code}
                              </span>
                            ) : (
                              <span className="text-secondary-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div
                              className="text-sm text-secondary-600"
                              title={formatDate(ncr.detected_at)}
                            >
                              {formatRelativeTime(ncr.detected_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/nonconformities/${ncr.id}`}>
                              <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח חריגה">
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
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!pagination.has_prev}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
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

      <CreateNCRModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateNCR}
      />
    </MainLayout>
  );
}

// Create NCR Modal Component
function CreateNCRModal({
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
    product_id: '',
    site_id: '',
    lot_number: '',
    defect_code: '',
    defect_description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; sku: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen]);

  const fetchOptions = async () => {
    try {
      const [productsRes, sitesRes] = await Promise.all([
        api.getProducts({ page_size: 100 }),
        api.getSites({ page_size: 100 }),
      ]);
      setProducts(productsRes.items);
      setSites(sitesRes.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת החריגה');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="יצירת חריגה חדשה (NCR)" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="כותרת *"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="תיאור קצר של החריגה"
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
          placeholder="תיאור מפורט של החריגה, כולל מדידות וראיות"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="מוצר"
            name="product_id"
            value={formData.product_id}
            onChange={handleChange}
            options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            placeholder="בחר מוצר"
          />
          <Select
            label="אתר/קו ייצור"
            name="site_id"
            value={formData.site_id}
            onChange={handleChange}
            options={sites.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
            placeholder="בחר אתר"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="מספר אצווה/מנה"
            name="lot_number"
            value={formData.lot_number}
            onChange={handleChange}
            placeholder="LOT-2026-XXX"
          />
          <Input
            label="קוד פגם"
            name="defect_code"
            value={formData.defect_code}
            onChange={handleChange}
            placeholder="DIM-001, SURF-002"
          />
          <Input
            label="תיאור פגם"
            name="defect_description"
            value={formData.defect_description}
            onChange={handleChange}
            placeholder="תיאור קצר של סוג הפגם"
          />
        </div>

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
            צור חריגה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
