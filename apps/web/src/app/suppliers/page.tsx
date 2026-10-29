'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Search, Star, Truck, XCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';

interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  quality_rating?: string | null;
  is_approved: boolean;
  is_active: boolean;
}

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSuppliers({ page: 1, page_size: 50, search: search || undefined });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הספקים');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Truck}
          title="ספקים"
          badge={<Badge variant="primary">{total} ספקים</Badge>}
          subtitle="ניהול ספקים, דירוג איכות ואישורים"
          actions={
            <Button variant="secondary" onClick={fetchSuppliers} loading={loading}>
              {!loading && <RefreshCw className="h-4 w-4" />}
              רענון
            </Button>
          }
        />

        <Card>
          <CardBody className="p-4">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="חיפוש לפי קוד או שם..."
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
                description={search ? 'נסה לשנות את מונח החיפוש' : 'הספקים יופיעו כאן לאחר הגדרתם במערכת'}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">קוד</TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead className="w-40">איש קשר</TableHead>
                      <TableHead className="w-52">אימייל</TableHead>
                      <TableHead className="w-32">דירוג איכות</TableHead>
                      <TableHead className="w-32">אישור</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                            {s.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-secondary-900">{s.name}</div>
                          {s.contact_phone && (
                            <div className="text-xs text-secondary-400 mt-0.5" dir="ltr">
                              {s.contact_phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-secondary-600">{s.contact_person || '—'}</TableCell>
                        <TableCell className="text-sm text-secondary-500" dir="ltr">
                          {s.contact_email || '—'}
                        </TableCell>
                        <TableCell>
                          {s.quality_rating ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-warning-500 fill-warning-500" />
                              <Badge variant={Number(s.quality_rating) >= 4 ? 'success' : 'warning'}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
}
