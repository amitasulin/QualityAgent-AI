'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import {
  buildCsv,
  downloadCsv,
  exportFileName,
  type ExportColumn,
} from '@/lib/export';

interface ExportButtonProps<T> {
  /** Column definitions, including the Hebrew header and value getter. */
  columns: ExportColumn<T>[];
  /** Base file name, without extension or timestamp. */
  filename: string;
  /** Already loaded rows (exports the current page/filter). */
  rows?: T[];
  /** Optional loader that returns every filtered record across all pages. */
  fetchRows?: () => Promise<T[]>;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
}

/**
 * One export control for every list screen. It builds a UTF-8 CSV that Excel
 * opens directly, using the current filters and every matching record.
 */
export function ExportButton<T>({
  columns,
  filename,
  rows = [],
  fetchRows,
  label = 'ייצוא לאקסל',
  disabled,
  size = 'md',
  variant = 'secondary',
}: ExportButtonProps<T>) {
  const [exporting, setExporting] = useState(false);

  const handleClick = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = fetchRows ? await fetchRows() : rows;
      if (data.length === 0) {
        toast.info('אין רשומות לייצוא עם הסינון הנוכחי');
        return;
      }
      downloadCsv(exportFileName(filename), buildCsv(columns, data));
      toast.success(`יוצאו ${data.length} רשומות לקובץ Excel (CSV)`);
    } catch (err) {
      console.error(err);
      toast.error('הייצוא נכשל, נסה שוב');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      loading={exporting}
      disabled={disabled}
    >
      {!exporting && <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}
