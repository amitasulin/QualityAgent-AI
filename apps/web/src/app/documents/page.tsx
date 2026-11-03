'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
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

export default function DocumentsPage() {
  const { canManageDocuments } = usePermissions();

  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Document | null>(null);
  const [archiving, setArchiving] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDocuments({
        page: query.page,
        page_size: query.pageSize,
        sort_by: query.sortBy,
        sort_order: query.sortOrder,
        search: debouncedSearch || undefined,
        status: status || undefined,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המסמכים');
    } finally {
      setLoading(false);
    }
  }, [query, debouncedSearch, status]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSort = (field: string) => {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleCreate = async (payload: Record<string, unknown>) => {
    if (typeof payload.tags === 'string') {
      payload.tags = textToTags(payload.tags);
    }
    await api.createDocument(payload);
    toast.success('המסמך נוצר בהצלחה');
    await fetchDocuments();
  };

  const handleArchiveToggle = async () => {
    if (!confirmTarget) return;
    setArchiving(true);
    const archivingDoc = confirmTarget.status !== 'archived';
    try {
      await api.updateDocument(confirmTarget.id, {
        status: archivingDoc ? 'archived' : 'draft',
      });
      toast.success(
        archivingDoc
          ? 'המסמך הועבר לארכיון — ניתן לשחזר אותו בכל עת'
          : 'המסמך שוחזר מהארכיון כטיוטה'
      );
      setConfirmTarget(null);
      await fetchDocuments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס המסמך נכשל'));
    } finally {
      setArchiving(false);
    }
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
              {canManageDocuments && (
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  מסמך חדש
                </Button>
              )}
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setQuery((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="pr-9"
                />
              </div>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setQuery((prev) => ({ ...prev, page: 1 }));
                }}
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
                        setQuery(DEFAULT_QUERY);
                      }}
                    >
                      איפוס סינון
                    </Button>
                  ) : canManageDocuments ? (
                    <Button onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4" />
                      מסמך חדש
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
                          className="w-32"
                        >
                          קוד
                        </SortableTableHead>
                        <SortableTableHead
                          field="title"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                        >
                          כותרת
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
                          field="status"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-28"
                        >
                          סטטוס
                        </SortableTableHead>
                        <SortableTableHead
                          field="effective_from"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-36"
                        >
                          תוקף מ־
                        </SortableTableHead>
                        <SortableTableHead
                          field="effective_until"
                          activeField={query.sortBy}
                          direction={query.sortOrder}
                          onSort={handleSort}
                          className="w-36"
                        >
                          תוקף עד
                        </SortableTableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((d) => (
                        <TableRow
                          key={d.id}
                          className={d.status === 'archived' ? 'group opacity-60' : 'group'}
                        >
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
                            <div className="flex items-center justify-end gap-1">
                              {canManageDocuments && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmTarget(d)}
                                  className={
                                    d.status === 'archived'
                                      ? 'p-1.5 text-secondary-400 hover:bg-success-50 hover:text-success-600'
                                      : 'p-1.5 text-secondary-400 hover:bg-warning-50 hover:text-warning-600'
                                  }
                                  title={d.status === 'archived' ? 'שחזר מהארכיון' : 'העבר לארכיון'}
                                  aria-label={
                                    d.status === 'archived'
                                      ? `שחזר את ${d.title} מהארכיון`
                                      : `העבר את ${d.title} לארכיון`
                                  }
                                >
                                  {d.status === 'archived' ? (
                                    <ArchiveRestore className="h-4 w-4" />
                                  ) : (
                                    <Archive className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Link href={`/documents/${d.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1.5"
                                  aria-label="פתח מסמך"
                                >
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

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleArchiveToggle}
        loading={archiving}
        variant={confirmTarget?.status === 'archived' ? 'primary' : 'danger'}
        title={
          confirmTarget?.status === 'archived' ? 'שחזור מסמך מהארכיון' : 'העברת מסמך לארכיון'
        }
        message={
          confirmTarget?.status === 'archived'
            ? `לשחזר את "${confirmTarget?.title ?? ''}" מהארכיון? המסמך יחזור לסטטוס טיוטה.`
            : `להעביר את "${confirmTarget?.title ?? ''}" לארכיון? המסמך יוסר מהרשימה הפעילה אך יישמר במערכת.`
        }
        confirmText={confirmTarget?.status === 'archived' ? 'שחזר' : 'העבר לארכיון'}
      />
    </MainLayout>
  );
}
