'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, FolderOpen, Plus, RefreshCw, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  DOCUMENT_FIELDS,
  DOCUMENT_INITIAL,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_STATUS_VARIANTS,
  textToTags,
} from '@/lib/documents';

interface Document {
  id: string;
  code: string;
  title: string;
  category?: string | null;
  status: string;
  effective_from?: string | null;
  effective_until?: string | null;
}

export default function DocumentsPage() {
  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDocuments({
        page: 1,
        page_size: 50,
        search: search || undefined,
        status: status || undefined,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המסמכים');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async (payload: Record<string, unknown>) => {
    if (typeof payload.tags === 'string') {
      payload.tags = textToTags(payload.tags);
    }
    await api.createDocument(payload);
    await fetchDocuments();
  };

  const hasActiveFilters = Boolean(search || status);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={FolderOpen}
          title="מסמכים"
          badge={<Badge variant="primary">{total} מסמכים</Badge>}
          subtitle="נהלים, הוראות עבודה ומפרטים"
          actions={
            <>
              <Button variant="secondary" onClick={fetchDocuments} loading={loading}>
                {!loading && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                מסמך חדש
              </Button>
            </>
          }
        />

        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-secondary-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="חיפוש לפי קוד או כותרת..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[{ value: '', label: 'כל הסטטוסים' }, ...DOCUMENT_STATUS_OPTIONS]}
                className="w-48"
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
                title={hasActiveFilters ? 'לא נמצאו מסמכים תואמים' : 'לא נמצאו מסמכים'}
                description={
                  hasActiveFilters
                    ? 'נסה לשנות את החיפוש או את הסינון'
                    : 'מסמכים ונהלים יופיעו כאן לאחר יצירתם'
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('');
                        setStatus('');
                      }}
                    >
                      איפוס סינון
                    </Button>
                  ) : (
                    <Button onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4" />
                      מסמך חדש
                    </Button>
                  )
                }
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
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((d) => (
                      <TableRow key={d.id} className="group">
                        <TableCell>
                          <Link
                            href={`/documents/${d.id}`}
                            className="font-mono text-xs font-semibold text-secondary-700 group-hover:text-primary-700"
                          >
                            {d.code}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[360px]">
                          <Link href={`/documents/${d.id}`} className="block">
                            <div className="font-medium text-secondary-900 group-hover:text-primary-700 truncate">
                              {d.title}
                            </div>
                            {d.category && (
                              <div className="text-xs text-secondary-400 truncate mt-0.5">
                                {d.category}
                              </div>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-secondary-600">
                          {d.category || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={DOCUMENT_STATUS_VARIANTS[d.status] || 'secondary'}>
                            {DOCUMENT_STATUS_LABELS[d.status] || d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                          {d.effective_from ? formatDate(d.effective_from) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                          {d.effective_until ? formatDate(d.effective_until) : '—'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/documents/${d.id}`}>
                            <Button variant="ghost" size="sm" className="p-1.5" aria-label="פתח מסמך">
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
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
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="מסמך חדש"
        description="הגדר קוד, כותרת וסטטוס — ניתן להוסיף גרסאות לאחר היצירה"
        fields={DOCUMENT_FIELDS}
        initialValues={DOCUMENT_INITIAL}
        submitLabel="צור מסמך"
        errorFallback="יצירת המסמך נכשלה"
        onSubmit={handleCreate}
      />
    </MainLayout>
  );
}
