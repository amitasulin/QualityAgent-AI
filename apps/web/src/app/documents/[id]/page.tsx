'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  History,
  Pencil,
  Plus,
  Save,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { DetailSkeleton, DetailError } from '@/components/master-data/EntityDetail';
import {
  EntityFormFields,
  payloadFromValues,
  valuesFromEntity,
  type FormValue,
  type FormValues,
} from '@/components/master-data/EntityFormFields';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';
import { toast } from '@/components/ui/Toast';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import {
  DOCUMENT_FIELDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_VARIANTS,
  formatFileSize,
  tagsToText,
  textToTags,
} from '@/lib/documents';

interface DocumentDetail {
  id: string;
  title: string;
  code: string;
  category?: string | null;
  description?: string | null;
  status: string;
  owner_id?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  tags: string[];
  current_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DocumentVersion {
  id: string;
  document_id: string;
  version: string;
  file_key: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  checksum?: string | null;
  change_summary?: string | null;
  is_current: boolean;
  uploaded_by_id?: string | null;
  created_at?: string;
}

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'success' | 'danger' | 'neutral' | 'primary' | 'warning';
}) {
  const valueTone = {
    success: 'text-success-600',
    danger: 'text-danger-600',
    neutral: 'text-secondary-900',
    primary: 'text-primary-600',
    warning: 'text-warning-600',
  }[tone];
  return (
    <div className="p-5 bg-white">
      <p className="text-sm text-secondary-500">{label}</p>
      <p className={cn('text-2xl font-extrabold mt-1 tabular-nums break-words', valueTone)}>{value}</p>
      {hint && <p className="text-xs text-secondary-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const { canManageDocuments } = usePermissions();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionSuccess, setVersionSuccess] = useState<string | null>(null);
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);

  const handleDownloadVersion = async (version: DocumentVersion) => {
    if (!document) return;
    setDownloadingVersionId(version.id);
    try {
      await api.downloadDocumentVersion(document.id, version.id, version.file_name);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'הורדת הקובץ נכשלה'));
    } finally {
      setDownloadingVersionId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [doc, versionList] = await Promise.all([
        api.getDocument(params.id),
        api.getDocumentVersions(params.id),
      ]);
      setDocument(doc);
      setVersions(versionList || []);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת המסמך');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEditing = () => {
    if (!document) return;
    const record = document as unknown as Record<string, unknown>;
    const nextValues = valuesFromEntity(record, DOCUMENT_FIELDS);
    nextValues.tags = tagsToText(document.tags);
    setValues(nextValues);
    setFormError(null);
    setEditing(true);
  };

  const handleChange = (name: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = payloadFromValues(values, DOCUMENT_FIELDS, 'update');
      payload.tags = textToTags(values.tags);
      const updated = await api.updateDocument(params.id, payload);
      setDocument(updated);
      setEditing(false);
      toast.success('השינויים נשמרו בהצלחה');
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'שמירת השינויים נכשלה'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!document) return;
    setArchiving(true);
    const archivingDoc = document.status !== 'archived';
    try {
      const updated = await api.updateDocument(document.id, {
        status: archivingDoc ? 'archived' : 'draft',
      });
      setDocument(updated);
      setShowArchiveConfirm(false);
      toast.success(
        archivingDoc
          ? 'המסמך הועבר לארכיון — ניתן לשחזר אותו בכל עת'
          : 'המסמך שוחזר מהארכיון כטיוטה'
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'עדכון סטטוס המסמך נכשל'));
    } finally {
      setArchiving(false);
    }
  };

  const currentVersion =
    versions.find((v) => v.id === document?.current_version_id) ||
    versions.find((v) => v.is_current) ||
    null;

  if (loading) return <DetailSkeleton />;
  if (error || !document) {
    return <DetailError message={error || 'המסמך לא נמצא'} backHref="/documents" onRetry={load} />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-primary-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה למסמכים
        </Link>

        <PageHeader
          icon={FolderOpen}
          title={document.title}
          subtitle={`מסמך · ${document.code}`}
          badge={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex rounded-md bg-secondary-100 px-2 py-1 font-mono text-xs font-semibold text-secondary-700">
                {document.code}
              </span>
              <Badge variant={DOCUMENT_STATUS_VARIANTS[document.status] || 'secondary'}>
                {DOCUMENT_STATUS_LABELS[document.status] || document.status}
              </Badge>
              {document.category && <Badge variant="secondary">{document.category}</Badge>}
            </div>
          }
          actions={
            <>
              {canManageDocuments && (
                <Button
                  variant="secondary"
                  onClick={() => setShowArchiveConfirm(true)}
                  className={
                    document.status === 'archived' ? 'text-success-700' : 'text-warning-700'
                  }
                >
                  {document.status === 'archived' ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {document.status === 'archived' ? 'שחזר מהארכיון' : 'העבר לארכיון'}
                </Button>
              )}
              {canManageDocuments && (
                <Button variant="secondary" onClick={() => setShowVersionModal(true)}>
                  <Upload className="h-4 w-4" />
                  העלאת גרסה
                </Button>
              )}
              {!editing && canManageDocuments && (
                <Button onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                  עריכה
                </Button>
              )}
            </>
          }
        />

        {versionSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4" />
            {versionSuccess}
          </div>
        )}

        {editing ? (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>עריכת מסמך</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setFormError(null);
                }}
                aria-label="סגור עריכה"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSave} className="space-y-5">
                <EntityFormFields fields={DOCUMENT_FIELDS} values={values} onChange={handleChange} />

                {formError && (
                  <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditing(false);
                      setFormError(null);
                    }}
                    disabled={saving}
                  >
                    ביטול
                  </Button>
                  <Button type="submit" loading={saving}>
                    <Save className="h-4 w-4" />
                    שמור שינויים
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <CardBody className="p-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-secondary-100">
                  <StatTile
                    label="סטטוס"
                    value={
                      <Badge variant={DOCUMENT_STATUS_VARIANTS[document.status] || 'secondary'}>
                        {DOCUMENT_STATUS_LABELS[document.status] || document.status}
                      </Badge>
                    }
                    hint="מצב המסמך במערכת"
                  />
                  <StatTile
                    label="גרסה נוכחית"
                    value={currentVersion ? `v${currentVersion.version}` : '—'}
                    hint={currentVersion ? currentVersion.file_name : 'לא הועלתה גרסה'}
                    tone={currentVersion ? 'primary' : 'neutral'}
                  />
                  <StatTile
                    label="תוקף מ־"
                    value={document.effective_from ? formatDate(document.effective_from) : '—'}
                    hint="תחילת תוקף"
                  />
                  <StatTile
                    label="גרסאות"
                    value={versions.length}
                    hint={versions.length === 1 ? 'גרסה אחת' : `${versions.length} גרסאות`}
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-600" />
                  <CardTitle>פרטי המסמך</CardTitle>
                </CardHeader>
                <CardBody>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <div className="py-3 border-b border-secondary-100">
                      <dt className="text-xs font-medium text-secondary-400">קוד מסמך</dt>
                      <dd className="mt-1 text-sm text-secondary-900 font-mono">{document.code}</dd>
                    </div>
                    <div className="py-3 border-b border-secondary-100">
                      <dt className="text-xs font-medium text-secondary-400">קטגוריה</dt>
                      <dd className="mt-1 text-sm text-secondary-900">{document.category || '—'}</dd>
                    </div>
                    <div className="py-3 border-b border-secondary-100">
                      <dt className="text-xs font-medium text-secondary-400">תוקף מ־</dt>
                      <dd className="mt-1 text-sm text-secondary-900">
                        {document.effective_from ? formatDate(document.effective_from) : '—'}
                      </dd>
                    </div>
                    <div className="py-3 border-b border-secondary-100">
                      <dt className="text-xs font-medium text-secondary-400">תוקף עד</dt>
                      <dd className="mt-1 text-sm text-secondary-900">
                        {document.effective_until ? formatDate(document.effective_until) : '—'}
                      </dd>
                    </div>
                    <div className="py-3 border-b border-secondary-100 sm:col-span-2">
                      <dt className="text-xs font-medium text-secondary-400">תיאור</dt>
                      <dd className="mt-1 text-sm text-secondary-900 whitespace-pre-line">
                        {document.description || '—'}
                      </dd>
                    </div>
                    <div className="py-3 border-b border-secondary-100 sm:col-span-2">
                      <dt className="text-xs font-medium text-secondary-400">תגיות</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {document.tags && document.tags.length > 0 ? (
                          document.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              <Tag className="h-3 w-3 ml-1" />
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-secondary-300">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 pt-4 text-xs text-secondary-400">
                    {document.created_at && <span>נוצר: {formatDateTime(document.created_at)}</span>}
                    {document.updated_at && <span>עודכן: {formatDateTime(document.updated_at)}</span>}
                  </div>
                </CardBody>
              </Card>

              <Card className="h-fit">
                <CardHeader className="flex items-center gap-2">
                  <History className="h-5 w-5 text-secondary-500" />
                  <CardTitle>היסטוריית גרסאות</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {versions.length === 0 ? (
                    <p className="text-sm text-secondary-500">
                      לא הועלו גרסאות למסמך זה. העלה גרסה ראשונה כדי להתחיל מעקב.
                    </p>
                  ) : (
                    versions.slice(0, 5).map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-secondary-200 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-secondary-900">v{version.version}</p>
                          <p className="text-xs text-secondary-400 truncate" title={version.file_name}>
                            {version.file_name}
                          </p>
                        </div>
                        {(version.is_current || version.id === document.current_version_id) && (
                          <Badge variant="success">נוכחית</Badge>
                        )}
                      </div>
                    ))
                  )}
                  <div className="flex items-center gap-2 pt-2 text-xs text-secondary-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {document.effective_until
                      ? `בתוקף עד ${formatDate(document.effective_until)}`
                      : 'ללא תאריך תפוגה'}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary-600" />
                  <CardTitle>כל הגרסאות</CardTitle>
                  <Badge variant="secondary">{versions.length}</Badge>
                </div>
                {canManageDocuments && (
                  <Button size="sm" variant="secondary" onClick={() => setShowVersionModal(true)}>
                    <Plus className="h-4 w-4" />
                    גרסה חדשה
                  </Button>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {versions.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="אין גרסאות"
                    description="העלה את הגרסה הראשונה של המסמך"
                    action={
                      canManageDocuments ? (
                        <Button onClick={() => setShowVersionModal(true)}>
                          <Upload className="h-4 w-4" />
                          העלאת גרסה
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">גרסה</TableHead>
                          <TableHead>שם קובץ</TableHead>
                          <TableHead className="w-28">גודל</TableHead>
                          <TableHead className="w-32">סוג</TableHead>
                          <TableHead className="w-64">שינוי</TableHead>
                          <TableHead className="w-40">הועלתה</TableHead>
                          <TableHead className="w-32"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versions.map((version) => (
                          <TableRow key={version.id}>
                            <TableCell className="font-mono text-sm font-semibold text-secondary-900">
                              v{version.version}
                            </TableCell>
                            <TableCell className="text-sm text-secondary-700 max-w-[280px] truncate">
                              {version.file_name}
                            </TableCell>
                            <TableCell className="text-sm text-secondary-500">
                              {formatFileSize(version.file_size)}
                            </TableCell>
                            <TableCell className="text-xs text-secondary-500">
                              {version.mime_type || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-secondary-500 max-w-[320px] truncate">
                              {version.change_summary || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-secondary-500 whitespace-nowrap">
                              {version.created_at ? formatDateTime(version.created_at) : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`הורד ${version.file_name}`}
                                  title="הורד קובץ"
                                  loading={downloadingVersionId === version.id}
                                  onClick={() => handleDownloadVersion(version)}
                                  className="text-primary-600 hover:text-primary-700"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {(version.is_current || version.id === document.current_version_id) && (
                                  <Badge variant="success">נוכחית</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <UploadVersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        document={document}
        nextVersion={
          versions.length > 0
            ? `${Math.max(...versions.map((v) => Number(v.version) || 0)) + 1}.0`
            : '1.0'
        }
        onUploaded={async (message) => {
          setVersionSuccess(message);
          toast.success(message);
          await load();
        }}
      />

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchiveToggle}
        loading={archiving}
        variant={document.status === 'archived' ? 'primary' : 'danger'}
        title={document.status === 'archived' ? 'שחזור מסמך מהארכיון' : 'העברת מסמך לארכיון'}
        message={
          document.status === 'archived'
            ? `לשחזר את "${document.title}" מהארכיון? המסמך יחזור לסטטוס טיוטה.`
            : `להעביר את "${document.title}" לארכיון? המסמך יוסר מהרשימה הפעילה אך יישמר במערכת.`
        }
        confirmText={document.status === 'archived' ? 'שחזר' : 'העבר לארכיון'}
      />
    </MainLayout>
  );
}

function UploadVersionModal({
  isOpen,
  onClose,
  document,
  nextVersion,
  onUploaded,
}: {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentDetail;
  nextVersion: string;
  onUploaded: (message: string) => Promise<void>;
}) {
  const [version, setVersion] = useState(nextVersion);
  const [file, setFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVersion(nextVersion);
      setFile(null);
      setChangeSummary('');
      setIsCurrent(true);
      setError(null);
    }
  }, [isOpen, nextVersion]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!version.trim() || !file) {
      setError('יש למלא מספר גרסה ולבחור קובץ');
      return;
    }

    setLoading(true);
    try {
      await api.uploadDocumentVersion(document.id, file, {
        version: version.trim(),
        change_summary: changeSummary.trim() || undefined,
        is_current: isCurrent,
      });
      onClose();
      await onUploaded(`הגרסה ${version.trim()} הועלתה בהצלחה`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'העלאת הגרסה נכשלה'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="העלאת גרסה חדשה"
      description={`מסמך ${document.code} · ${document.title}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="מספר גרסה *"
            name="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0"
            dir="ltr"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1.5">קובץ *</label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-secondary-300 bg-secondary-50 px-4 py-6 cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
            <Upload className="h-6 w-6 text-secondary-400" />
            <span className="text-sm font-medium text-secondary-700 max-w-full truncate">
              {file ? file.name : 'בחר קובץ להעלאה'}
            </span>
            <span className="text-xs text-secondary-500">
              {file
                ? `${formatFileSize(file.size)} · ${file.type || 'סוג לא ידוע'}`
                : 'PDF, Word, Excel או תמונה — עד 15MB'}
            </span>
            <input
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <Textarea
          label="תיאור השינוי"
          name="change_summary"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          rows={3}
          placeholder="מה השתנה בגרסה זו?"
        />

        <label className="flex items-center gap-2.5 rounded-lg border border-secondary-200 bg-white px-3 py-2.5 cursor-pointer hover:bg-secondary-50 transition-colors">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-secondary-700">
            הפוך לגרסה הנוכחית של המסמך
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            ביטול
          </Button>
          <Button type="submit" loading={loading}>
            <Upload className="h-4 w-4" />
            העלה גרסה
          </Button>
        </div>
      </form>
    </Modal>
  );
}
