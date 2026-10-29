'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, Search, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';

interface Customer {
  id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  quality_requirements?: string | null;
  is_active: boolean;
}

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCustomers({ page: 1, page_size: 50, search: search || undefined });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הלקוחות');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Users}
          title="לקוחות"
          badge={<Badge variant="primary">{total} לקוחות</Badge>}
          subtitle="ניהול לקוחות ודרישות איכות"
          actions={
            <Button variant="secondary" onClick={fetchCustomers} loading={loading}>
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
                <Button variant="secondary" className="mt-4" onClick={fetchCustomers}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="לא נמצאו לקוחות"
                description={search ? 'נסה לשנות את מונח החיפוש' : 'הלקוחות יופיעו כאן לאחר הגדרתם במערכת'}
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
                      <TableHead>דרישות איכות</TableHead>
                      <TableHead className="w-24">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                            {c.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-secondary-900">{c.name}</TableCell>
                        <TableCell className="text-sm text-secondary-600">{c.contact_person || '—'}</TableCell>
                        <TableCell className="text-sm text-secondary-500">
                          {c.contact_email ? (
                            <span className="inline-flex items-center gap-1.5" dir="ltr">
                              <Mail className="h-3.5 w-3.5 text-secondary-400" />
                              {c.contact_email}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-secondary-600 max-w-xs truncate" title={c.quality_requirements || ''}>
                          {c.quality_requirements || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? 'success' : 'secondary'}>
                            {c.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
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
