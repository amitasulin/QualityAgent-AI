'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Document {
  id: string;
  code: string;
  title: string;
  category?: string | null;
  status: string;
  effective_from?: string | null;
  effective_until?: string | null;
}

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  under_review: 'בבדיקה',
  approved: 'מאושר',
  published: 'פורסם',
  archived: 'בארכיון',
  obsolete: 'מיושן',
};

const statusVariants: Record<string, 'secondary' | 'warning' | 'success' | 'primary'> = {
  draft: 'secondary',
  under_review: 'warning',
  approved: 'primary',
  published: 'success',
  archived: 'secondary',
  obsolete: 'secondary',
};

export default function DocumentsPage() {
  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDocuments({ page: 1, page_size: 50, search: search || undefined });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המסמכים');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={FolderOpen}
          title="מסמכים"
          badge={<Badge variant="primary">{total} מסמכים</Badge>}
          subtitle="נהלים, הוראות עבודה ומפרטים"
          actions={
            <Button variant="secondary" onClick={fetchDocuments} loading={loading}>
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
                placeholder="חיפוש לפי קוד או כותרת..."
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
                <Button variant="secondary" className="mt-4" onClick={fetchDocuments}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="לא נמצאו מסמכים"
                description={search ? 'נסה לשנות את מונח החיפוש' : 'מסמכים ונהלים יופיעו כאן לאחר העלאתם'}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">קוד</TableHead>
                      <TableHead>כותרת</TableHead>
                      <TableHead className="w-36">קטגוריה</TableHead>
                      <TableHead className="w-28">סטטוס</TableHead>
                      <TableHead className="w-36">תוקף מ־</TableHead>
                      <TableHead className="w-36">תוקף עד</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-secondary-700">{d.code}</span>
                        </TableCell>
                        <TableCell className="font-medium text-secondary-900">{d.title}</TableCell>
                        <TableCell className="text-sm text-secondary-600">{d.category || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariants[d.status] || 'secondary'}>
                            {statusLabels[d.status] || d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                          {d.effective_from ? formatDate(d.effective_from) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                          {d.effective_until ? formatDate(d.effective_until) : '—'}
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
