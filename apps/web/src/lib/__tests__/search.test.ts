import { describe, expect, it } from 'vitest';

import { searchStatusLabel, totalSearchResults, parseRecentSearches, addRecentSearch } from '../search';

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

  it('parses recent searches defensively', () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches('not json')).toEqual([]);
    expect(parseRecentSearches('{"a":1}')).toEqual([]);
    expect(parseRecentSearches('["מכולה", 3, "", "NCR"]')).toEqual(['מכולה', 'NCR']);
  });

  it('adds a search to the front without duplicates', () => {
    expect(addRecentSearch([], 'מכולה')).toEqual(['מכולה']);
    expect(addRecentSearch(['NCR', 'מכולה'], 'מכולה')).toEqual(['מכולה', 'NCR']);
    expect(addRecentSearch(['NCR'], 'a')).toEqual(['NCR']);
  });

  it('keeps only the five newest searches', () => {
    const list = ['aa', 'bb', 'cc', 'dd', 'ee'];
    expect(addRecentSearch(list, 'ff')).toEqual(['ff', 'aa', 'bb', 'cc', 'dd']);
  });
});
