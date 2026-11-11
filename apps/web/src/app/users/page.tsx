'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCog,
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
import {
  valuesFromEntity,
  type FieldDef,
  type FormValues,
} from '@/components/master-data/EntityFormFields';
import { api } from '@/lib/api';
import { getApiErrorMessage, type Site } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  USER_ROLE_OPTIONS,
  getUserInitials,
  getUserRoleBadge,
  getUserRoleLabel,
  type User,
} from '@/lib/users';

interface ListQuery {
  page: number;
  pageSize: number;
}

const DEFAULT_QUERY: ListQuery = {
  page: 1,
  pageSize: 20,
};

const USER_INITIAL: FormValues = {
  full_name: '',
  email: '',
  password: '',
  role: 'viewer',
  site_id: '',
  phone: '',
  is_active: true,
};

function buildUserFields(
  mode: 'create' | 'update',
  siteOptions: Array<{ value: string; label: string }>,
  roleOptions: Array<{ value: string; label: string }>,
  roleDisabled = false
): FieldDef[] {
  return [
    { name: 'full_name', label: 'שם מלא *', required: true, placeholder: 'ישראל ישראלי' },
    { name: 'email', label: 'אימייל *', type: 'email', required: true, dir: 'ltr', placeholder: 'name@company.com' },
    {
      name: 'password',
      label: mode === 'create' ? 'סיסמה *' : 'סיסמה חדשה',
      type: 'password',
      required: mode === 'create',
      dir: 'ltr',
      placeholder: mode === 'create' ? 'לפחות 8 תווים' : 'השאר ריק כדי לא לשנות',
      helperText: mode === 'create' ? 'לפחות 8 תווים' : 'מלא רק כדי לאפס את הסיסמה',
    },
    {
      name: 'role',
      label: 'תפקיד *',
      type: 'select',
      required: true,
      options: roleOptions,
      disabled: roleDisabled,
      helperText: roleDisabled ? 'רק מנהל מערכת יכול לשנות תפקיד' : undefined,
    },
    {
      name: 'site_id',
      label: 'אתר משויך',
      type: 'select',
      options: siteOptions,
      placeholder: 'ללא שיוך',
      helperText: 'ניתן להשאיר ללא שיוך',
    },
    { name: 'phone', label: 'טלפון', type: 'tel', dir: 'ltr', placeholder: '050-1234567' },
    { name: 'is_active', label: 'משתמש פעיל', type: 'checkbox' },
  ];
}

export default function UsersPage() {
  const { canManageMasterData, user: currentUser } = usePermissions();

  const [items, setItems] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUsers({
        page: query.page,
        page_size: query.pageSize,
        search: debouncedSearch || undefined,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המשתמשים');
    } finally {
      setLoading(false);
    }
  }, [query, debouncedSearch]);

  const fetchSites = useCallback(async () => {
    try {
      const data = await api.getSites({ page: 1, page_size: 100, is_active: true });
      setSites(data.items || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!canManageMasterData) {
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [canManageMasterData, fetchUsers]);

  useEffect(() => {
    if (canManageMasterData) {
      fetchSites();
    }
  }, [canManageMasterData, fetchSites]);

  const siteOptions = useMemo(
    () => sites.map((site) => ({ value: site.id, label: site.name })),
    [sites]
  );

  const siteNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites) map.set(site.id, site.name);
    return map;
  }, [sites]);

  const isAdmin = currentUser?.role === 'admin';

  const roleOptions = useMemo(
    () => (isAdmin ? USER_ROLE_OPTIONS : USER_ROLE_OPTIONS.filter((option) => option.value !== 'admin')),
    [isAdmin]
  );

  const createFields = useMemo(
    () => buildUserFields('create', siteOptions, roleOptions),
    [siteOptions, roleOptions]
  );
  const updateFields = useMemo(
    () => buildUserFields('update', siteOptions, roleOptions, !isAdmin),
    [siteOptions, roleOptions, isAdmin]
  );

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!isAdmin) delete data.role;
    await api.createUser(data);
    toast.success('המשתמש נוצר בהצלחה');
    await fetchUsers();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editTarget) return;
    if (!isAdmin) delete data.role;
    await api.updateUser(editTarget.id, data);
    toast.success('המשתמש עודכן בהצלחה');
    await fetchUsers();
  };

  const handleToggleActive = async () => {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      const nextActive = !confirmTarget.is_active;
      await api.updateUser(confirmTarget.id, { is_active: nextActive });
      toast.success(nextActive ? 'המשתמש הופעל מחדש' : 'המשתמש הושבת — לא נמחק מהמערכת');
      setConfirmTarget(null);
      await fetchUsers();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס המשתמש נכשל'));
    } finally {
      setToggling(false);
    }
  };

  if (!canManageMasterData) {
    return (
      <MainLayout>
        <Card>
          <CardBody className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-warning-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-secondary-900">אין הרשאה לצפות במסך זה</h2>
            <p className="mt-1 text-sm text-secondary-500">
              ניהול משתמשים זמין למנהלי מערכת ומנהלי איכות בלבד.
            </p>
          </CardBody>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={UserCog}
          title="משתמשים"
          badge={<Badge variant="primary">{total} משתמשים</Badge>}
          subtitle="ניהול משתמשים, תפקידים והרשאות"
          actions={
            <>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" />
                הוספת משתמש
              </Button>
              <Button variant="secondary" onClick={fetchUsers} loading={loading}>
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
                placeholder="חיפוש לפי שם או אימייל..."
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
                    <div className="h-9 w-9 rounded-full bg-secondary-100" />
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
                <Button variant="secondary" className="mt-4" onClick={fetchUsers}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title="לא נמצאו משתמשים"
                description={
                  search ? 'נסה לשנות את מונח החיפוש' : 'הוסף משתמש ראשון כדי להתחיל לנהל הרשאות'
                }
                action={
                  !search ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      הוספת משתמש
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
                        <TableHead>משתמש</TableHead>
                        <TableHead className="w-40">תפקיד</TableHead>
                        <TableHead className="w-40">אתר</TableHead>
                        <TableHead className="w-44">טלפון</TableHead>
                        <TableHead className="w-24">סטטוס</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const isSelf = item.id === currentUser?.id;
                        return (
                          <TableRow key={item.id} className={item.is_active ? undefined : 'opacity-60'}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                                  {getUserInitials(item.full_name)}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-secondary-900">
                                    {item.full_name}
                                    {isSelf && (
                                      <span className="mr-2 text-xs font-normal text-secondary-400">(אתה)</span>
                                    )}
                                  </p>
                                  <p className="flex items-center gap-1.5 text-xs text-secondary-500" dir="ltr">
                                    <Mail className="h-3 w-3" />
                                    {item.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getUserRoleBadge(item.role)}>
                                {getUserRoleLabel(item.role)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-secondary-600">
                              {item.site_id ? siteNames.get(item.site_id) || '—' : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-secondary-500">
                              {item.phone ? (
                                <span className="flex items-center gap-1.5" dir="ltr">
                                  <Phone className="h-3.5 w-3.5 text-secondary-400" />
                                  {item.phone}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.is_active ? 'success' : 'secondary'}>
                                {item.is_active ? 'פעיל' : 'לא פעיל'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditTarget(item)}
                                  className="p-1.5 text-secondary-400 hover:bg-primary-50 hover:text-primary-600"
                                  title="עריכת משתמש"
                                  aria-label={`ערוך את ${item.full_name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {!isSelf && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmTarget(item)}
                                    className={
                                      item.is_active
                                        ? 'p-1.5 text-secondary-400 hover:bg-danger-50 hover:text-danger-600'
                                        : 'p-1.5 text-secondary-400 hover:bg-success-50 hover:text-success-600'
                                    }
                                    title={item.is_active ? 'השבת משתמש' : 'הפעל משתמש'}
                                    aria-label={item.is_active ? `השבת את ${item.full_name}` : `הפעל את ${item.full_name}`}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
        title="הוספת משתמש חדש"
        description="המשתמש יוכל להתחבר מיד עם האימייל והסיסמה שתגדיר."
        fields={createFields}
        initialValues={USER_INITIAL}
        submitLabel="צור משתמש"
        errorFallback="יצירת המשתמש נכשלה"
        onSubmit={handleCreate}
      />

      <CreateEntityModal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="עריכת משתמש"
        description="עדכן את פרטי המשתמש. השאר את הסיסמה ריקה כדי לא לשנות אותה."
        fields={
          editTarget?.id === currentUser?.id
            ? updateFields.map((field) =>
                field.name === 'is_active'
                  ? { ...field, disabled: true, helperText: 'לא ניתן להשבית את החשבון שלך' }
                  : field
              )
            : updateFields
        }
        initialValues={
          editTarget
            ? valuesFromEntity(editTarget as unknown as Record<string, unknown>, updateFields)
            : USER_INITIAL
        }
        submitLabel="שמור שינויים"
        errorFallback="עדכון המשתמש נכשל"
        mode="update"
        onSubmit={handleUpdate}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        loading={toggling}
        variant={confirmTarget?.is_active ? 'danger' : 'primary'}
        title={confirmTarget?.is_active ? 'השבתת משתמש' : 'הפעלת משתמש'}
        message={
          confirmTarget?.is_active
            ? `להשבית את "${confirmTarget.full_name}"? המשתמש לא יימחק ולא יוכל להתחבר, וניתן להפעיל אותו מחדש.`
            : `להפעיל מחדש את "${confirmTarget?.full_name ?? ''}"?`
        }
        confirmText={confirmTarget?.is_active ? 'השבת' : 'הפעל'}
      />
    </MainLayout>
  );
}
