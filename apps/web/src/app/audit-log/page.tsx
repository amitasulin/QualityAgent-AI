'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
  ShieldAlert,
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
} from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButton } from '@/components/export/ExportButton';
import { PrintButton } from '@/components/export/PrintButton';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { collectAllPages, formatExportDateTime, type ExportColumn } from '@/lib/export';
import {
  ACTION_OPTIONS,
  ENTITY_OPTIONS,
  actionLabel,
  actionTone,
  entityLabel,
  shortId,
  type AuditEvent,
} from '@/lib/audit';

interface Filters {
  entityType: string;
  action: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  entityType: '',
  action: '',
  dateFrom: '',
  dateTo: '',
};

/** Convert a date input value (YYYY-MM-DD) to the ISO timestamp the API expects. */
function startOfDay(value: string): string | undefined {
  return value ? `${value}T00:00:00` : undefined;
}

function endOfDay(value: string): string | undefined {
  return value ? `${value}T23:59:59` : undefined;
}

function buildParams(filters: Filters) {
  return {
    entity_type: filters.entityType || undefined,
    action: filters.action || undefined,
    date_from: startOfDay(filters.dateFrom),
    date_to: endOfDay(filters.dateTo),
  };
}

function detailValue(event: AuditEvent, key: string): string {
  const value = event.new_values?.[key];
  return value === undefined || value === null ? '—' : String(value);
}

export default function AuditLogPage() {
  const { isManager } = usePermissions();

  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAuditEvents({
        page,
        page_size: pageSize,
        ...buildParams(filters),
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת יומן הפעולות');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }
    fetchEvents();
  }, [isManager, fetchEvents]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const fetchAllEvents = useCallback(
    () =>
      collectAllPages<AuditEvent>((nextPage, nextPageSize) =>
        api.getAuditEvents({
          page: nextPage,
          page_size: nextPageSize,
          ...buildParams(filters),
        })
      ),
    [filters]
  );

  const exportColumns = useMemo<ExportColumn<AuditEvent>[]>(
    () => [
      { header: 'מועד', value: (event) => formatExportDateTime(event.created_at) },
      {
        header: 'משתמש',
        value: (event) => event.actor_name || (event.actor_type === 'system' ? 'מערכת' : ''),
      },
      { header: 'פעולה', value: (event) => actionLabel(event.action) },
      { header: 'ישות', value: (event) => entityLabel(event.entity_type) },
      { header: 'מזהה ישות', value: (event) => event.entity_id || '' },
      { header: 'כתובת IP', value: (event) => event.ip_address || '' },
      { header: 'נתיב', value: (event) => detailValue(event, 'path') },
      { header: 'שיטה', value: (event) => detailValue(event, 'method') },
      { header: 'סטטוס', value: (event) => detailValue(event, 'status') },
    ],
    []
  );

  const hasFilters =
    Boolean(filters.entityType) ||
    Boolean(filters.action) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  if (!isManager) {
    return (
      <MainLayout>
        <Card>
          <CardBody className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-warning-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-secondary-900">
              אין הרשאה לצפות במסך זה
            </h2>
            <p className="mt-1 text-sm text-secondary-500">
              יומן הפעולות זמין למנהלי מערכת ומנהלי איכות בלבד.
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
          icon={History}
          title="יומן פעולות"
          badge={<Badge variant="primary">{total} רשומות</Badge>}
          subtitle="תיעוד מלא של כל יצירה, עדכון ומחיקה — מי, מתי ומאיפה"
          actions={
            <>
              <PrintButton
                title="יומן פעולות"
                subtitle="דוח מלא לפי הסינון הנוכחי"
                columns={exportColumns}
                fetchRows={fetchAllEvents}
                disabled={loading || total === 0}
              />
              <ExportButton
                filename="audit-log"
                columns={exportColumns}
                fetchRows={fetchAllEvents}
                disabled={loading || total === 0}
              />
              <Button variant="secondary" onClick={fetchEvents} loading={loading}>
                {!loading && <RefreshCw className="h-4 w-4" />}
                רענון
              </Button>
            </>
          }
        />

        <Card>
          <CardBody className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="סוג ישות"
                value={filters.entityType}
                onChange={(e) => updateFilter('entityType', e.target.value)}
                options={[{ value: '', label: 'כל הישויות' }, ...ENTITY_OPTIONS]}
              />
              <Select
                label="פעולה"
                value={filters.action}
                onChange={(e) => updateFilter('action', e.target.value)}
                options={[{ value: '', label: 'כל הפעולות' }, ...ACTION_OPTIONS]}
              />
              <Input
                label="מתאריך"
                type="date"
                dir="ltr"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
              />
              <Input
                label="עד תאריך"
                type="date"
                dir="ltr"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
              />
            </div>
            {hasFilters && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                >
                  ניקוי סינון
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardBody className="p-0">
            {loading ? (
              <div className="divide-y divide-secondary-100">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                    <div className="h-3.5 w-32 rounded bg-secondary-100" />
                    <div className="h-3 w-24 rounded bg-secondary-50" />
                    <div className="h-6 w-20 rounded-full bg-secondary-100" />
                    <div className="h-3 w-28 rounded bg-secondary-50" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
                <p className="mt-3 text-danger-600">{error}</p>
                <Button variant="secondary" className="mt-4" onClick={fetchEvents}>
                  <RefreshCw className="h-4 w-4" />
                  נסה שוב
                </Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={History}
                title="לא נמצאו פעולות"
                description={
                  hasFilters
                    ? 'נסה לשנות את הסינון או טווח התאריכים'
                    : 'יומן הפעולות יתמלא אוטומטית בכל יצירה, עדכון או מחיקה במערכת'
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-44">מועד</TableHead>
                        <TableHead className="w-44">משתמש</TableHead>
                        <TableHead className="w-40">פעולה</TableHead>
                        <TableHead className="w-40">ישות</TableHead>
                        <TableHead className="w-32">מזהה</TableHead>
                        <TableHead className="w-32">כתובת IP</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((event) => {
                        const isExpanded = expandedId === event.id;
                        return (
                          <Fragment key={event.id}>
                            <TableRow>
                              <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                                {formatDateTime(event.created_at)}
                              </TableCell>
                              <TableCell className="text-sm font-medium text-secondary-900">
                                {event.actor_name ||
                                  (event.actor_type === 'system' ? 'מערכת' : '—')}
                              </TableCell>
                              <TableCell>
                                <Badge variant={actionTone(event.action)}>
                                  {actionLabel(event.action)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-secondary-700">
                                {entityLabel(event.entity_type)}
                              </TableCell>
                              <TableCell>
                                <span
                                  className="font-mono text-xs text-secondary-500"
                                  dir="ltr"
                                  title={event.entity_id || undefined}
                                >
                                  {shortId(event.entity_id)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-secondary-500" dir="ltr">
                                  {event.ip_address || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1.5 text-secondary-400 hover:bg-primary-50 hover:text-primary-600"
                                  onClick={() =>
                                    setExpandedId(isExpanded ? null : event.id)
                                  }
                                  title={isExpanded ? 'סגור פרטים' : 'הצג פרטים'}
                                  aria-label={
                                    isExpanded ? 'סגור פרטי פעולה' : 'הצג פרטי פעולה'
                                  }
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={7} className="bg-secondary-50">
                                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                      <dt className="text-xs text-secondary-500">נתיב</dt>
                                      <dd className="font-mono text-xs text-secondary-800" dir="ltr">
                                        {detailValue(event, 'method')}{' '}
                                        {detailValue(event, 'path')}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-secondary-500">סטטוס תגובה</dt>
                                      <dd className="text-secondary-800">
                                        {detailValue(event, 'status')}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-secondary-500">מזהה מתאם</dt>
                                      <dd className="font-mono text-xs text-secondary-800" dir="ltr">
                                        {event.correlation_id || '—'}
                                      </dd>
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-3">
                                      <dt className="text-xs text-secondary-500">דפדפן / לקוח</dt>
                                      <dd
                                        className="break-all text-xs text-secondary-600"
                                        dir="ltr"
                                      >
                                        {event.user_agent || '—'}
                                      </dd>
                                    </div>
                                  </dl>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                  disabled={loading}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
}
