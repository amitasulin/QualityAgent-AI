'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Plus,
  Power,
  RefreshCw,
  Search,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import { api } from '@/lib/api';
import { SUPPLIER_FIELDS, SUPPLIER_INITIAL } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Supplier } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';

interface ListQuery {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_QUERY: ListQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'created_at',
  sortOrder: 'desc',
};

export default function SuppliersPage() {
  const { canManageMasterData } = usePermissions();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Supplier | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSuppliers({
        page: query.page,
        page_size: query.pageSize,
        sort_by: query.sortBy,
        sort_order: query.sortOrder,
        search: debouncedSearch || undefined,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הספקים');
    } finally {
      setLoading(false);
    }
  }, [query, debouncedSearch]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSort = (field: string) => {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    await api.createSupplier(data);
    toast.success('הספק נוצר בהצלחה');
    await fetchSuppliers();
  };

  const handleToggleActive = async () => {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      const nextActive = !confirmTarget.is_active;
      await api.updateSupplier(confirmTarget.id, { is_active: nextActive });
      toast.success(
        nextActive ? 'הספק הופעל מחדש' : 'הספק הושבת — לא נמחק מהמערכת'
      );
      setConfirmTarget(null);
      await fetchSuppliers();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס הספק נכשל'));
    } finally {
      setToggling(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Truck}
          title="ספקים"
          badge={<Badge variant="primary">{total} ספקים</Badge>}
          subtitle="ניהול ספקים, דירוג איכות ואישורים"
          actions={
            <>
              {canManageMasterData && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" />
                  הוספת ספק
                </Button>
              )}
              <Button variant="secondary" onClick={fetchSuppliers} loading={loading}>
                {!loading && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
            </>
          }
        />

        <Card>
          <CardBody className="p-4">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="חיפוש לפי קוד או שם..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setQuery((prev) => ({ ...prev, page: 1 }));
                }}
                className="pr-9"
              />
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardBody className="p-0">
            {loading ? (
              <div className="divide-y divide-secondary-100">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                    <div className="h-3.5 w-16 rounded bg-secondary-100" />
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
                <Button variant="secondary" className="mt-4" onClick={fetchSuppliers}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="לא נמצאו ספקים"
                description={
                  search
                    ? 'נסה לשנות את מונח החיפוש'
                    : 'הוסף ספק ראשון כדי להתחיל לנהל דירוגי איכות ואישורים'
                }
                action={
                  !search && canManageMasterData ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      הוספת ספק
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
                        <SortableTableHead
                          field="code"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-28"
                        >
                          קוד
                        </SortableTableHead>
                        <SortableTableHead
                          field="name"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                        >
                          שם
                        </SortableTableHead>
                        <SortableTableHead
                          field="contact_person"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-40"
                        >
                          איש קשר
                        </SortableTableHead>
                        <TableHead className="w-52">אימייל</TableHead>
                        <SortableTableHead
                          field="quality_rating"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-32"
                        >
                          דירוג איכות
                        </SortableTableHead>
                        <TableHead className="w-28">אישור</TableHead>
                        <TableHead className="w-24">סטטוס</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((s) => (
                        <TableRow key={s.id} className={s.is_active ? undefined : 'opacity-60'}>
                          <TableCell>
                            <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                              {s.code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/suppliers/${s.id}`}
                              className="font-medium text-secondary-900 hover:text-primary-600 hover:underline"
                            >
                              {s.name}
                            </Link>
                            {s.contact_phone && (
                              <div className="text-xs text-secondary-400 mt-0.5" dir="ltr">
                                {s.contact_phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">
                            {s.contact_person || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-secondary-500" dir="ltr">
                            {s.contact_email || '—'}
                          </TableCell>
                          <TableCell>
                            {s.quality_rating !== null && s.quality_rating !== undefined ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5 text-warning-500 fill-warning-500" />
                                <Badge
                                  variant={Number(s.quality_rating) >= 4 ? 'success' : 'warning'}
                                >
                                  {Number(s.quality_rating).toFixed(1)}
                                </Badge>
                              </span>
                            ) : (
                              <span className="text-secondary-300">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.is_approved ? (
                              <span className="inline-flex items-center gap-1.5 text-success-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" /> מאושר
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-secondary-400 text-sm">
                                <XCircle className="h-4 w-4" /> לא מאושר
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.is_active ? 'success' : 'secondary'}>
                              {s.is_active ? 'פעיל' : 'לא פעיל'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canManageMasterData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmTarget(s)}
                                  className={
                                    s.is_active
                                      ? 'p-1.5 text-secondary-400 hover:bg-danger-50 hover:text-danger-600'
                                      : 'p-1.5 text-secondary-400 hover:bg-success-50 hover:text-success-600'
                                  }
                                  title={s.is_active ? 'השבת ספק' : 'הפעל ספק'}
                                  aria-label={s.is_active ? `השבת את ${s.name}` : `הפעל את ${s.name}`}
                                >
                                  <Power className="h-4 w-4" />
                                </Button>
                              )}
                              <Link
                                href={`/suppliers/${s.id}`}
                                aria-label={`פתח את ${s.name}`}
                                className="inline-flex text-secondary-400 hover:text-primary-600"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Pagination
                  page={query.page}
                  pageSize={query.pageSize}
                  total={total}
                  totalPages={totalPages}
                  onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
                  onPageSizeChange={(pageSize) =>
                    setQuery((prev) => ({ ...prev, page: 1, pageSize }))
                  }
                  disabled={loading}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CreateEntityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="הוספת ספק חדש"
        description="קוד ושם הם שדות חובה. דירוג איכות ואישור ניתן לעדכן בהמשך."
        fields={SUPPLIER_FIELDS}
        initialValues={SUPPLIER_INITIAL}
        submitLabel="צור ספק"
        errorFallback="יצירת הספק נכשלה"
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        loading={toggling}
        variant={confirmTarget?.is_active ? 'danger' : 'primary'}
        title={confirmTarget?.is_active ? 'השבתת ספק' : 'הפעלת ספק'}
        message={
          confirmTarget?.is_active
            ? `להשבית את "${confirmTarget.name}"? הספק לא יימחק, וניתן להפעיל אותו מחדש בכל עת.`
            : `להפעיל מחדש את "${confirmTarget?.name ?? ''}"?`
        }
        confirmText={confirmTarget?.is_active ? 'השבת' : 'הפעל'}
      />
    </MainLayout>
  );
}
