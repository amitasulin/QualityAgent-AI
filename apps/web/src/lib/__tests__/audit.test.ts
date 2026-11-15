import { describe, expect, it } from 'vitest';

import {
  ACTION_OPTIONS,
  ENTITY_OPTIONS,
  actionLabel,
  actionTone,
  entityLabel,
  shortId,
} from '@/lib/audit';

describe('audit labels', () => {
  it('translates known entities and actions to Hebrew', () => {
    expect(entityLabel('nonconformity')).toBe('אי התאמה');
    expect(entityLabel('corrective_action')).toBe('פעולה מתקנת');
    expect(actionLabel('create')).toBe('יצירה');
    expect(actionLabel('status_change')).toBe('שינוי סטטוס');
  });

  it('falls back to the raw value for unknown keys', () => {
    expect(entityLabel('custom_entity')).toBe('custom_entity');
    expect(actionLabel('custom_action')).toBe('custom_action');
    expect(actionTone('custom_action')).toBe('secondary');
  });

  it('normalises legacy uppercase actions from seeded data', () => {
    expect(actionLabel('CREATE')).toBe('יצירה');
    expect(actionLabel('ASSIGN')).toBe('הקצאה');
    expect(actionTone('CREATE_RECOMMENDATION')).toBe('primary');
  });

  it('exposes options for the filters', () => {
    expect(ENTITY_OPTIONS.every((option) => option.value && option.label)).toBe(true);
    expect(ACTION_OPTIONS.some((option) => option.value === 'delete')).toBe(true);
  });

  it('shortens ids for display', () => {
    expect(shortId('8d4a6a39-bc2f-46ab-84b8-0c092ca1c887')).toBe('8d4a6a39');
    expect(shortId(null)).toBe('—');
  });
});
