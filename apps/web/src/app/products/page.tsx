'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, Package, Plus, Power, RefreshCw, Search } from 'lucide-react';
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
import { PRODUCT_FIELDS, PRODUCT_INITIAL } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Product } from '@/lib/master-data';
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

export default function ProductsPage() {
  const { canManageMasterData } = usePermissions();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts({
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
      setError('שגיאה בטעינת המוצרים');
    } finally {
      setLoading(false);
    }
  }, [query, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSort = (field: string) => {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    await api.createProduct(data);
    toast.success('המוצר נוצר בהצלחה');
    await fetchProducts();
  };

  const handleToggleActive = async () => {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      const nextActive = !confirmTarget.is_active;
      await api.updateProduct(confirmTarget.id, { is_active: nextActive });
      toast.success(
        nextActive ? 'המוצר הופעל מחדש' : 'המוצר הושבת — לא נמחק מהמערכת'
      );
      setConfirmTarget(null);
      await fetchProducts();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס המוצר נכשל'));
    } finally {
      setToggling(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Package}
          title="מוצרים"
          badge={<Badge variant="primary">{total} מוצרים</Badge>}
          subtitle="קטלוג מוצרים, גרסאות ומפרטים"
          actions={
            <>
              {canManageMasterData && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" />
                  הוספת מוצר
                </Button>
              )}
              <Button variant="secondary" onClick={fetchProducts} loading={loading}>
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
                placeholder="חיפוש לפי מק&quot;ט או שם..."
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
                    <div className="h-3.5 w-20 rounded bg-secondary-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 rounded bg-secondary-100" />
                      <div className="h-3 w-1/4 rounded bg-secondary-50" />
                    </div>
                    <div className="h-6 w-16 rounded-full bg-secondary-100" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
                <p className="mt-3 text-danger-600">{error}</p>
                <Button variant="secondary" className="mt-4" onClick={fetchProducts}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="לא נמצאו מוצרים"
                description={
                  search
                    ? 'נסה לשנות את מונח החיפוש'
                    : 'הוסף מוצר ראשון כדי להתחיל לנהל גרסאות ומפרטים'
                }
                action={
                  !search && canManageMasterData ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      הוספת מוצר
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
                          field="sku"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-32"
                        >
                          מק&quot;ט
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
                          field="category"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-36"
                        >
                          קטגוריה
                        </SortableTableHead>
                        <SortableTableHead
                          field="revision"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-24"
                        >
                          גרסה
                        </SortableTableHead>
                        <TableHead className="w-24">יחידה</TableHead>
                        <TableHead className="w-24">סטטוס</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((p) => (
                        <TableRow key={p.id} className={p.is_active ? undefined : 'opacity-60'}>
                          <TableCell className="whitespace-nowrap">
                            <span className="font-mono text-sm font-semibold text-secondary-900">
                              {p.sku}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/products/${p.id}`}
                              className="font-medium text-secondary-900 hover:text-primary-600 hover:underline"
                            >
                              {p.name}
                            </Link>
                            {p.description && (
                              <div className="text-xs text-secondary-400 truncate max-w-md mt-0.5">
                                {p.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">
                            {p.category || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{p.revision}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">
                            {p.unit || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.is_active ? 'success' : 'secondary'}>
                              {p.is_active ? 'פעיל' : 'לא פעיל'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canManageMasterData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmTarget(p)}
                                  className={
                                    p.is_active
                                      ? 'p-1.5 text-secondary-400 hover:bg-danger-50 hover:text-danger-600'
                                      : 'p-1.5 text-secondary-400 hover:bg-success-50 hover:text-success-600'
                                  }
                                  title={p.is_active ? 'השבת מוצר' : 'הפעל מוצר'}
                                  aria-label={p.is_active ? `השבת את ${p.name}` : `הפעל את ${p.name}`}
                                >
                                  <Power className="h-4 w-4" />
                                </Button>
                              )}
                              <Link
                                href={`/products/${p.id}`}
                                aria-label={`פתח את ${p.name}`}
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
        title="הוספת מוצר חדש"
        description={'מק"ט ושם הם שדות חובה. גרסה ברירת מחדל היא 1.0.'}
        fields={PRODUCT_FIELDS}
        initialValues={PRODUCT_INITIAL}
        submitLabel="צור מוצר"
        errorFallback="יצירת המוצר נכשלה"
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        loading={toggling}
        variant={confirmTarget?.is_active ? 'danger' : 'primary'}
        title={confirmTarget?.is_active ? 'השבתת מוצר' : 'הפעלת מוצר'}
        message={
          confirmTarget?.is_active
            ? `להשבית את "${confirmTarget.name}"? המוצר לא יימחק, וניתן להפעיל אותו מחדש בכל עת.`
            : `להפעיל מחדש את "${confirmTarget?.name ?? ''}"?`
        }
        confirmText={confirmTarget?.is_active ? 'השבת' : 'הפעל'}
      />
    </MainLayout>
  );
}
