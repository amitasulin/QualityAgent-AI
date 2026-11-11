import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  getResolvedTheme,
  getStoredTheme,
  resolveTheme,
  setTheme,
} from '@/lib/theme';

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  const media = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.push(listener);
    },
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => media),
  });

  return { media, listeners };
}

describe('theme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    mockMatchMedia(false);
  });

  it('defaults to system when nothing is stored', () => {
    expect(getStoredTheme()).toBe('system');
  });

  it('reads a stored theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('falls back to system for invalid stored values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(getStoredTheme()).toBe('system');
  });

  it('resolves explicit themes without consulting the system', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolves system from prefers-color-scheme', () => {
    mockMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
    mockMatchMedia(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('applies dark mode to the document root', () => {
    const resolved = applyTheme('dark');
    expect(resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('removes dark mode when applying light', () => {
    applyTheme('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('reports the currently applied theme', () => {
    applyTheme('dark');
    expect(getResolvedTheme()).toBe('dark');
    applyTheme('light');
    expect(getResolvedTheme()).toBe('light');
  });

  it('persists the theme and dispatches a change event', () => {
    const handler = vi.fn();
    window.addEventListener(THEME_EVENT, handler);

    const resolved = setTheme('dark');

    expect(resolved).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('dark');

    window.removeEventListener(THEME_EVENT, handler);
  });

  it('persists system and applies the resolved value', () => {
    mockMatchMedia(true);
    expect(setTheme('system')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
