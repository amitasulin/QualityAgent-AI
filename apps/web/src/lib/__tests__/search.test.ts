import { describe, expect, it } from 'vitest';

import { searchStatusLabel, totalSearchResults } from '../search';

describe('search helpers', () => {
  it('translates known statuses to Hebrew', () => {
    expect(searchStatusLabel('open')).toBe('פתוח');
    expect(searchStatusLabel('in_progress')).toBe('בביצוע');
    expect(searchStatusLabel('closed')).toBe('סגור');
  });

  it('falls back to the raw value for unknown statuses', () => {
    expect(searchStatusLabel('custom_state')).toBe('custom_state');
  });

  it('returns null when there is no status', () => {
    expect(searchStatusLabel(null)).toBeNull();
    expect(searchStatusLabel(undefined)).toBeNull();
  });

  it('reads the total number of results', () => {
    expect(totalSearchResults(null)).toBe(0);
    expect(totalSearchResults({ query: 'a', total: 4, groups: [] })).toBe(4);
  });
});
