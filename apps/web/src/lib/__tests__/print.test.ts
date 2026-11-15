import { describe, expect, it } from 'vitest';

import type { ExportColumn } from '../export';
import { buildPrintHtml, escapeHtml } from '../print';

interface Row {
  name: string;
  note?: string;
}

const columns: ExportColumn<Row>[] = [
  { header: 'שם', value: (row) => row.name },
  { header: 'הערה', value: (row) => row.note },
];

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<b>"A" & B</b>')).toBe(
      '&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;'
    );
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('buildPrintHtml', () => {
  it('renders a right-to-left report with headers and rows', () => {
    const html = buildPrintHtml({
      title: 'דוח אי התאמות',
      subtitle: 'כל הרשומות',
      columns,
      rows: [{ name: 'NCR-1', note: 'פתוח' }],
    });

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('דוח אי התאמות');
    expect(html).toContain('כל הרשומות');
    expect(html).toContain('<th>שם</th>');
    expect(html).toContain('<td>NCR-1</td>');
    expect(html).toContain('<td>פתוח</td>');
    expect(html).toContain('1 רשומות');
  });

  it('does not inject raw HTML from record values', () => {
    const html = buildPrintHtml({
      title: 'דוח',
      columns,
      rows: [{ name: '<script>alert(1)</script>' }],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('still renders the table header when there are no rows', () => {
    const html = buildPrintHtml({ title: 'דוח', columns, rows: [] });
    expect(html).toContain('<th>שם</th>');
    expect(html).toContain('0 רשומות');
  });
});
