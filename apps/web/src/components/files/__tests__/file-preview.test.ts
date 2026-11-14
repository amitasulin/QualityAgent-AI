import { describe, expect, it } from 'vitest';

import { canPreviewFile, isDocxFile } from '../FilePreviewModal';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('file preview support', () => {
  it('supports images, PDFs, text and Word documents', () => {
    expect(canPreviewFile('image/png')).toBe(true);
    expect(canPreviewFile('application/pdf')).toBe(true);
    expect(canPreviewFile('text/plain')).toBe(true);
    expect(canPreviewFile(DOCX)).toBe(true);
  });

  it('rejects formats the browser cannot render', () => {
    expect(canPreviewFile('application/vnd.ms-excel')).toBe(false);
    expect(canPreviewFile('application/msword')).toBe(false);
    expect(canPreviewFile(null)).toBe(false);
    expect(canPreviewFile(undefined)).toBe(false);
  });

  it('detects Word documents separately', () => {
    expect(isDocxFile(DOCX)).toBe(true);
    expect(isDocxFile('application/pdf')).toBe(false);
    expect(isDocxFile(null)).toBe(false);
  });
});
