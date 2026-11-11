'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
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
} from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { CreateEntityModal } from '@/components/master-data/CreateEntityModal';
import { valuesFromEntity } from '@/components/master-data/EntityFormFields';
import { api } from '@/lib/api';
import { SITE_FIELDS, SITE_INITIAL } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Site } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';

interface ListQuery {
  page: number;
  pageSize: number;
}

const DEFAULT_QUERY: ListQuery = {
  page: 1,
  pageSize: 20,
};

export default function SitesPage() {
  const { canManageMasterData } = usePermissions();

  const [items, setItems] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Site | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSites({
        page: query.page,
        page_size: query.pageSize,
        search: debouncedSearch || undefined,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת האתרים');
    } finally {
      setLoading(false);
    }
  }, [query, debouncedSearch]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleCreate = async (data: Record<string, unknown>) => {
    await api.createSite(data);
    toast.success('האתר נוצר בהצלחה');
    await fetchSites();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editTarget) return;
    await api.updateSite(editTarget.id, data);
    toast.success('האתר עודכן בהצלחה');
    await fetchSites();
  };

  const handleToggleActive = async () => {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      const nextActive = !confirmTarget.is_active;
      await api.updateSite(confirmTarget.id, { is_active: nextActive });
      toast.success(nextActive ? 'האתר הופעל מחדש' : 'האתר הושבת — לא נמחק מהמערכת');
      setConfirmTarget(null);
      await fetchSites();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס האתר נכשל'));
    } finally {
      setToggling(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Building2}
          title="אתרים"
          badge={<Badge variant="primary">{total} אתרים</Badge>}
          subtitle="ניהול אתרי ומפעלי הארגון"
          actions={
            <>
              {canManageMasterData && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" />
                  הוספת אתר
                </Button>
              )}
              <Button variant="secondary" onClick={fetchSites} loading={loading}>
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
                placeholder="חיפוש לפי שם, קוד או כתובת..."
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
                <Button variant="secondary" className="mt-4" onClick={fetchSites}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="לא נמצאו אתרים"
                description={
                  search
                    ? 'נסה לשנות את מונח החיפוש'
                    : 'הוסף אתר ראשון כדי לשייך אליו משתמשים ובדיקות'
                }
                action={
                  !search && canManageMasterData ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      הוספת אתר
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
                        <TableHead className="w-28">קוד</TableHead>
                        <TableHead>שם</TableHead>
                        <TableHead className="w-40">איש קשר</TableHead>
                        <TableHead className="w-56">פרטי קשר</TableHead>
                        <TableHead>כתובת</TableHead>
                        <TableHead className="w-24">סטטוס</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((site) => (
                        <TableRow key={site.id} className={site.is_active ? undefined : 'opacity-60'}>
                          <TableCell>
                            {site.code ? (
                              <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                                {site.code}
                              </span>
                            ) : (
                              <span className="text-secondary-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-secondary-900">
                            {site.name}
                          </TableCell>
                          <TableCell className="text-sm text-secondary-600">
                            {site.contact_person || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-secondary-500">
                            <div className="space-y-1">
                              {site.contact_email && (
                                <span className="flex items-center gap-1.5" dir="ltr">
                                  <Mail className="h-3.5 w-3.5 text-secondary-400" />
                                  {site.contact_email}
                                </span>
                              )}
                              {site.contact_phone && (
                                <span className="flex items-center gap-1.5" dir="ltr">
                                  <Phone className="h-3.5 w-3.5 text-secondary-400" />
                                  {site.contact_phone}
                                </span>
                              )}
                              {!site.contact_email && !site.contact_phone && '—'}
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-sm text-secondary-600 max-w-xs truncate"
                            title={site.address || ''}
                          >
                            {site.address || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={site.is_active ? 'success' : 'secondary'}>
                              {site.is_active ? 'פעיל' : 'לא פעיל'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canManageMasterData && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditTarget(site)}
                                    className="p-1.5 text-secondary-400 hover:bg-primary-50 hover:text-primary-600"
                                    title="עריכת אתר"
                                    aria-label={`ערוך את ${site.name}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmTarget(site)}
                                    className={
                                      site.is_active
                                        ? 'p-1.5 text-secondary-400 hover:bg-danger-50 hover:text-danger-600'
                                        : 'p-1.5 text-secondary-400 hover:bg-success-50 hover:text-success-600'
                                    }
                                    title={site.is_active ? 'השבת אתר' : 'הפעל אתר'}
                                    aria-label={site.is_active ? `השבת את ${site.name}` : `הפעל את ${site.name}`}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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
        title="הוספת אתר חדש"
        description="שם האתר הוא שדה חובה. שאר הפרטים ניתן להשלים מאוחר יותר."
        fields={SITE_FIELDS}
        initialValues={SITE_INITIAL}
        submitLabel="צור אתר"
        errorFallback="יצירת האתר נכשלה"
        onSubmit={handleCreate}
      />

      <CreateEntityModal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="עריכת אתר"
        description="עדכן את פרטי האתר. שדות שרוקנו יימחקו."
        fields={SITE_FIELDS}
        initialValues={editTarget ? valuesFromEntity(editTarget as unknown as Record<string, unknown>, SITE_FIELDS) : SITE_INITIAL}
        submitLabel="שמור שינויים"
        errorFallback="עדכון האתר נכשל"
        mode="update"
        onSubmit={handleUpdate}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        loading={toggling}
        variant={confirmTarget?.is_active ? 'danger' : 'primary'}
        title={confirmTarget?.is_active ? 'השבתת אתר' : 'הפעלת אתר'}
        message={
          confirmTarget?.is_active
            ? `להשבית את "${confirmTarget.name}"? האתר לא יימחק, והמשתמשים והרשומות המשויכים אליו יישארו ללא שינוי.`
            : `להפעיל מחדש את "${confirmTarget?.name ?? ''}"?`
        }
        confirmText={confirmTarget?.is_active ? 'השבת' : 'הפעל'}
      />
    </MainLayout>
  );
}
