/**
 * Shared CSV export helpers.
 *
 * The files are UTF-8 with a BOM and CRLF line endings so Excel (including the
 * Hebrew version) opens them with the right encoding and columns. Everything is
 * pure except `downloadCsv`, which only touches the DOM in the browser.
 */

export interface ExportColumn<T> {
  /** Column title shown in the first row of the file. */
  header: string;
  /** Reads the printable value for one record. */
  value: (row: T) => string | number | null | undefined;
}

export interface PageResponse<T> {
  items: T[];
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
}

/** Cap the number of pages we will follow, so a bad API response cannot hang the UI. */
const MAX_EXPORT_PAGES = 200;

/** Values that a spreadsheet would treat as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Quote one CSV cell. Quotes are doubled, and text that starts like a formula
 * is prefixed with an apostrophe so spreadsheets do not execute it.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_PREFIX.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** Build a complete CSV document (BOM + header row + CRLF line endings). */
export function buildCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(',')
  );
  return `\ufeff${[header, ...body].join('\r\n')}`;
}

/** Trigger a browser download for the given CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** `nonconformities` -> `nonconformities_2026-11-15_1430.csv` */
export function exportFileName(base: string, now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-');
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}_${stamp}_${time}.csv`;
}

/** Stable `dd/mm/yyyy` for spreadsheets (locale-independent). */
export function formatExportDate(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Stable `dd/mm/yyyy hh:mm` for spreadsheets. */
export function formatExportDateTime(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${formatExportDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fetch every page of a filtered list, not just the page on screen.
 * The API caps `page_size`, so the loop follows `total_pages` from the response.
 */
export async function collectAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PageResponse<T>>,
  pageSize = 100
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const rows = [...(first.items ?? [])];

  const reportedPages =
    first.total_pages && first.total_pages > 0
      ? first.total_pages
      : first.total
        ? Math.ceil(first.total / pageSize)
        : 1;
  const totalPages = Math.min(reportedPages, MAX_EXPORT_PAGES);

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page, pageSize);
    rows.push(...(next.items ?? []));
  }
  return rows;
}
