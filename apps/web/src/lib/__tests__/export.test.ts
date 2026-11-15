import { describe, expect, it, vi } from 'vitest';

import {
  buildCsv,
  collectAllPages,
  escapeCsvCell,
  exportFileName,
  formatExportDate,
  formatExportDateTime,
  type ExportColumn,
} from '../export';

interface Row {
  name: string;
  count: number;
  note?: string | null;
}

const columns: ExportColumn<Row>[] = [
  { header: 'שם', value: (row) => row.name },
  { header: 'כמות', value: (row) => row.count },
  { header: 'הערה', value: (row) => row.note },
];

describe('escapeCsvCell', () => {
  it('wraps values in quotes and escapes inner quotes', () => {
    expect(escapeCsvCell('שלום')).toBe('"שלום"');
    expect(escapeCsvCell('אמר "כן"')).toBe('"אמר ""כן"""');
  });

  it('turns null and undefined into empty cells', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    expect(escapeCsvCell('=1+1')).toBe(`"'=1+1"`);
    expect(escapeCsvCell('-3')).toBe('"-3"');
    expect(escapeCsvCell(-3)).toBe('"-3"');
  });
});

describe('buildCsv', () => {
  it('starts with a BOM and uses CRLF between rows', () => {
    const csv = buildCsv(columns, [{ name: 'בדיקה', count: 2, note: null }]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toBe('\ufeff"שם","כמות","הערה"\r\n"בדיקה","2",');
  });

  it('keeps the header when there are no rows', () => {
    expect(buildCsv(columns, [])).toBe('\ufeff"שם","כמות","הערה"');
  });
});

describe('exportFileName', () => {
  it('adds a stable date and time stamp', () => {
    const date = new Date(2026, 10, 5, 9, 7);
    expect(exportFileName('nonconformities', date)).toBe(
      'nonconformities_2026-11-05_0907.csv'
    );
  });
});

describe('date formatting', () => {
  it('formats dates without locale surprises', () => {
    expect(formatExportDate('2026-11-15T10:30:00Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(formatExportDateTime('2026-11-15T10:30:00Z')).toMatch(
      /^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/
    );
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(formatExportDate(null)).toBe('');
    expect(formatExportDate('not a date')).toBe('');
    expect(formatExportDateTime(undefined)).toBe('');
  });
});

describe('collectAllPages', () => {
  it('follows total_pages and merges every page', async () => {
    const fetchPage = vi.fn(async (page: number, pageSize: number) => ({
      items: [{ id: page }],
      page,
      page_size: pageSize,
      total: 3,
      total_pages: 3,
    }));

    const rows = await collectAllPages(fetchPage, 1);

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('derives the page count from total when total_pages is missing', async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: [{ id: page }],
      total: 5,
    }));

    const rows = await collectAllPages(fetchPage, 2);

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('handles an empty result', async () => {
    const rows = await collectAllPages(async () => ({ items: [] }));
    expect(rows).toEqual([]);
  });
});
