/**
 * Print-to-PDF helper.
 *
 * There is no server-side PDF renderer in this app, so "PDF" means a clean,
 * print-ready report opened in a new window. The browser's print dialog can
 * then save it as a PDF. The report always contains every filtered record,
 * not just the page on screen.
 */

import { formatExportDateTime, type ExportColumn } from './export';

export interface PrintTableOptions<T> {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

/** Escape text before putting it into the generated HTML document. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_STYLES = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1e293b;
    margin: 0;
    direction: rtl;
  }
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .brand { font-size: 11px; color: #64748b; margin-bottom: 6px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #475569; line-height: 1.6; }
  .meta-end { text-align: left; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  thead { display: table-header-group; }
  th {
    background: #eff6ff;
    color: #1e3a8a;
    text-align: right;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    font-weight: 600;
  }
  td {
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    word-break: break-word;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .report-footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
`;

/** Build the full standalone HTML document for the report. */
export function buildPrintHtml<T>(options: PrintTableOptions<T>): string {
  const { title, subtitle, columns, rows } = options;
  const generatedAt = formatExportDateTime(new Date());
  const header = columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(column.value(row))}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="brand">QualityAgent · מערכת ניהול איכות</div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="meta">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="meta meta-end">
      הופק ב־${escapeHtml(generatedAt)}<br />
      ${rows.length} רשומות
    </div>
  </div>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="report-footer">
    <span>QualityAgent</span>
    <span>${rows.length} רשומות</span>
  </div>
</body>
</html>`;
}

/**
 * Open the report window immediately (inside the click handler, so popup
 * blockers allow it) and show a loading message until the rows arrive.
 */
export function openPrintWindow(title: string): Window | null {
  if (typeof window === 'undefined') return null;
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) return null;
  win.document.open();
  win.document.write(`<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="font-family: Arial, sans-serif; padding: 32px; color: #334155;">
  טוען את הנתונים לדוח…
</body>
</html>`);
  win.document.close();
  return win;
}

/** Replace the loading page with the finished report and open the print dialog. */
export function printTable<T>(win: Window, options: PrintTableOptions<T>): void {
  if (!win || win.closed) return;
  win.document.open();
  win.document.write(buildPrintHtml(options));
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    if (!win.closed) win.print();
  }, 300);
}
