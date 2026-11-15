'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { type ExportColumn } from '@/lib/export';
import { openPrintWindow, printTable } from '@/lib/print';

interface PrintButtonProps<T> {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows?: T[];
  fetchRows?: () => Promise<T[]>;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Opens a print-ready report with every filtered record. The user can save it
 * as PDF from the browser's print dialog.
 */
export function PrintButton<T>({
  title,
  subtitle,
  columns,
  rows = [],
  fetchRows,
  label = 'PDF',
  disabled,
  size = 'md',
}: PrintButtonProps<T>) {
  const [printing, setPrinting] = useState(false);

  const handleClick = async () => {
    if (printing) return;
    const win = openPrintWindow(title);
    if (!win) {
      toast.error('הדפדפן חסם את חלון הדוח. אפשר חלונות קופצים ונסה שוב.');
      return;
    }
    setPrinting(true);
    try {
      const data = fetchRows ? await fetchRows() : rows;
      if (data.length === 0) {
        win.close();
        toast.info('אין רשומות לייצוא עם הסינון הנוכחי');
        return;
      }
      printTable(win, { title, subtitle, columns, rows: data });
      toast.success('נפתח חלון הדוח — בחר "שמירה כ-PDF" בהדפסה');
    } catch (err) {
      console.error(err);
      if (!win.closed) win.close();
      toast.error('יצירת הדוח נכשלה, נסה שוב');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={handleClick}
      loading={printing}
      disabled={disabled}
    >
      {!printing && <Printer className="h-4 w-4" />}
      {label}
    </Button>
  );
}
