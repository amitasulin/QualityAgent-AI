'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FilePreviewModal } from '@/components/files/FilePreviewModal';
import { toast } from '@/components/ui/Toast';
import { api, FileNotStoredError } from '@/lib/api';
import { formatFileSize } from '@/lib/documents';
import { getApiErrorMessage } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';

export type AttachmentEntityType = 'complaint' | 'inspection' | 'corrective_action' | 'task';

export interface Attachment {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  created_at?: string;
}

interface AttachmentsCardProps {
  entityType: AttachmentEntityType;
  entityId: string;
  title?: string;
}

/**
 * Upload, preview, download and delete files attached to a record.
 * Mirrors the NCR attachments card so every module behaves the same way.
 */
export function AttachmentsCard({
  entityType,
  entityId,
  title = 'קבצים מצורפים',
}: AttachmentsCardProps) {
  const { user, isManager } = usePermissions();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAttachments(entityType, entityId);
      setAttachments(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'טעינת הקבצים נכשלה'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadAttachment(entityType, entityId, file);
      await load();
      toast.success('הקובץ הועלה בהצלחה');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'העלאת הקובץ נכשלה'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    try {
      await api.downloadAttachment(attachment.id, attachment.file_name);
    } catch (err) {
      toast.error(
        err instanceof FileNotStoredError
          ? err.message
          : getApiErrorMessage(err, 'הורדת הקובץ נכשלה')
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteAttachment(toDelete.id);
      setToDelete(null);
      await load();
      toast.success('הקובץ נמחק');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'מחיקת הקובץ נכשלה'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-secondary-500" />
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{attachments.length}</Badge>
          {user && (
            <div className="mr-auto">
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                העלה קובץ
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody className={attachments.length ? 'pt-2' : undefined}>
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-secondary-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען קבצים...
            </div>
          ) : attachments.length > 0 ? (
            <ul className="divide-y divide-secondary-100">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm text-secondary-900">
                    <Paperclip className="h-4 w-4 shrink-0 text-secondary-400" />
                    <span className="truncate" title={attachment.file_name}>
                      {attachment.file_name}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{formatFileSize(attachment.file_size)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`צפה ב${attachment.file_name}`}
                      title="צפייה בקובץ"
                      onClick={() => setPreview(attachment)}
                      className="text-secondary-500 hover:text-secondary-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`הורד ${attachment.file_name}`}
                      title="הורד קובץ"
                      loading={downloadingId === attachment.id}
                      onClick={() => handleDownload(attachment)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`מחק ${attachment.file_name}`}
                        title="מחק קובץ"
                        onClick={() => setToDelete(attachment)}
                        className="text-danger-500 hover:text-danger-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary-500">אין קבצים מצורפים</p>
          )}
        </CardBody>
      </Card>

      <FilePreviewModal
        isOpen={Boolean(preview)}
        onClose={() => setPreview(null)}
        path={preview ? `/attachments/${preview.id}/download` : null}
        fileName={preview?.file_name ?? ''}
        mimeType={preview?.mime_type}
        fileSize={preview?.file_size}
      />

      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="מחיקת קובץ מצורף"
        message={`למחוק את "${toDelete?.file_name ?? ''}"? הפעולה אינה ניתנת לשחזור.`}
        confirmText="מחק"
        loading={deleting}
      />
    </>
  );
}
