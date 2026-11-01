'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, Package, Plus, RefreshCw, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import { api } from '@/lib/api';
import { PRODUCT_FIELDS, PRODUCT_INITIAL } from '@/lib/master-data-fields';
import type { Product } from '@/lib/master-data';

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts({ page: 1, page_size: 50, search: search || undefined });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המוצרים');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreate = async (data: Record<string, unknown>) => {
    await api.createProduct(data);
    await fetchProducts();
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
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" />
                הוספת מוצר
              </Button>
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
                onChange={(e) => setSearch(e.target.value)}
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
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">מק&quot;ט</TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead className="w-36">קטגוריה</TableHead>
                      <TableHead className="w-24">גרסה</TableHead>
                      <TableHead className="w-24">יחידה</TableHead>
                      <TableHead className="w-24">סטטוס</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id}>
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
                        <TableCell className="text-sm text-secondary-600">{p.unit || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? 'success' : 'secondary'}>
                            {p.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <Link
                            href={`/products/${p.id}`}
                            aria-label={`פתח את ${p.name}`}
                            className="inline-flex text-secondary-400 hover:text-primary-600"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
    </MainLayout>
  );
}
