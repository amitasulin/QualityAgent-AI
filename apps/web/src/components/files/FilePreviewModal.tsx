'use client';

import { useEffect, useRef, useState } from 'react';
import { FileQuestion, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { api, FileNotStoredError } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/master-data';
import { formatFileSize } from '@/lib/documents';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isDocxFile(mimeType?: string | null): boolean {
  return mimeType === DOCX_MIME;
}

export function canPreviewFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    isDocxFile(mimeType)
  );
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: string | null;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

/**
 * Shows a stored file inside the app: images, PDFs, text and Word documents.
 * Rendering the blob locally keeps authentication working even though the API
 * lives on another origin.
 */
export function FilePreviewModal({
  isOpen,
  onClose,
  path,
  fileName,
  mimeType,
  fileSize,
}: FilePreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [docx, setDocx] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docxContainer = useRef<HTMLDivElement>(null);
  const previewable = canPreviewFile(mimeType);
  const isDocx = isDocxFile(mimeType);

  useEffect(() => {
    if (!isOpen || !path || !previewable) {
      setUrl(null);
      setText(null);
      setDocx(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);
    setText(null);
    setDocx(null);

    api
      .getFileBlob(path)
      .then(async (blob) => {
        if (cancelled) return;
        if (isDocx) {
          setDocx(await blob.arrayBuffer());
        } else if (mimeType?.startsWith('text/')) {
          setText(await blob.text());
        } else {
          objectUrl = window.URL.createObjectURL(
            new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' })
          );
          setUrl(objectUrl);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof FileNotStoredError
            ? err.message
            : getApiErrorMessage(err, 'טעינת הקובץ נכשלה')
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, path, mimeType, previewable, isDocx]);

  // Word documents are rendered into the DOM once their bytes are available.
  useEffect(() => {
    if (!docx || loading || !docxContainer.current) return;
    const container = docxContainer.current;
    let cancelled = false;
    container.innerHTML = '';

    import('docx-preview')
      .then(({ renderAsync }) =>
        renderAsync(docx, container, undefined, {
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
          useBase64URL: true,
        })
      )
      .then(() => {
        if (cancelled) container.innerHTML = '';
      })
      .catch(() => {
        if (!cancelled) setError('תצוגת המסמך נכשלה — אפשר להוריד אותו ולפתוח ב-Word');
      });

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [docx, loading]);

  const description = [mimeType, formatFileSize(fileSize)].filter((v) => v && v !== '—').join(' · ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={fileName}
      description={description || undefined}
      size="xl"
      bodyClassName="p-0"
    >
      <div className="h-[70vh] bg-secondary-50 flex items-center justify-center overflow-hidden">
        {!previewable ? (
          <div className="text-center px-6">
            <FileQuestion className="h-12 w-12 text-secondary-400 mx-auto" />
            <p className="mt-3 text-sm font-medium text-secondary-700">
              סוג קובץ זה אינו ניתן לתצוגה בדפדפן
            </p>
            <p className="mt-1 text-sm text-secondary-500">
              אפשר להוריד אותו מהרשימה ולהציג בתוכנה המתאימה.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-secondary-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            טוען קובץ...
          </div>
        ) : error ? (
          <p className="px-6 text-sm text-danger-600 text-center">{error}</p>
        ) : text !== null ? (
          <pre
            dir="auto"
            className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-white p-6 text-sm text-secondary-800"
          >
            {text}
          </pre>
        ) : docx ? (
          <div ref={docxContainer} className="h-full w-full overflow-auto bg-white p-6" />
        ) : url && mimeType?.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
        ) : url ? (
          <iframe src={url} title={fileName} className="h-full w-full bg-white" />
        ) : null}
      </div>
    </Modal>
  );
}
