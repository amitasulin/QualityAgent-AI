'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Package,
  Search,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { searchStatusLabel, type SearchResponse } from '@/lib/search';

const GROUP_ICONS: Record<string, LucideIcon> = {
  nonconformity: ClipboardList,
  corrective_action: CheckSquare,
  document: FileText,
  task: ClipboardCheck,
  complaint: MessageSquareWarning,
  inspection: ClipboardCheck,
  product: Package,
  customer: Users,
  supplier: Truck,
  site: MapPin,
};

/** Header search that queries every module and jumps straight to a record. */
export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebouncedValue(query, 300);
  const term = query.trim();
  const canSearch = term.length >= 2;
  const items = useMemo(() => data?.groups.flatMap((group) => group.items) ?? [], [data]);
  const indexes = useMemo(
    () => new Map(items.map((item, index) => [item.href, index])),
    [items]
  );
  const isOpen = focused && canSearch;

  useEffect(() => {
    const value = debounced.trim();
    if (value.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .search(value)
      .then((response: SearchResponse) => {
        if (cancelled) return;
        setData(response);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError('החיפוש נכשל. נסה שוב.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setFocused(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const goTo = (href: string) => {
    setQuery('');
    setData(null);
    setActiveIndex(-1);
    setFocused(false);
    setMobileOpen(false);
    router.push(href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setFocused(false);
      setMobileOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || items.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goTo(items[activeIndex >= 0 ? activeIndex : 0].href);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-none md:mx-6 md:w-full md:max-w-md md:flex-1">
      <button
        type="button"
        className="md:hidden p-2 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-100"
        aria-label="חיפוש גלובלי"
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen((open) => !open);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className="h-5 w-5" />
      </button>

      <div
        className={cn(
          mobileOpen ? 'fixed left-4 right-4 top-[4.5rem] z-50' : 'relative hidden md:block'
        )}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="חיפוש בכל המערכת..."
            className="h-10 w-full rounded-lg border border-secondary-200 bg-white pr-10 pl-10 text-sm text-secondary-900 placeholder-secondary-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {loading ? (
            <Loader2 className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-secondary-400" />
          ) : (
            term && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                aria-label="נקה חיפוש"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        {isOpen && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-lg"
          >
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {error ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-danger-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              ) : loading && items.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-secondary-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מחפש...
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-secondary-500">
                  לא נמצאו תוצאות עבור &quot;{term}&quot;
                </div>
              ) : (
                data?.groups.map((group) => {
                  const Icon = GROUP_ICONS[group.type] ?? FileText;
                  return (
                    <div key={group.type}>
                      <p className="px-3 pb-1 pt-2 text-xs font-medium text-secondary-400">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const index = indexes.get(item.href) ?? -1;
                        const status = searchStatusLabel(item.status);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={index === activeIndex}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => goTo(item.href)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              'flex w-full items-start gap-3 px-3 py-2 text-right transition-colors hover:bg-secondary-50',
                              index === activeIndex && 'bg-secondary-50'
                            )}
                          >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-secondary-400" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-secondary-900">
                                {item.title}
                              </span>
                              {(item.subtitle || status) && (
                                <span className="mt-0.5 flex items-center gap-2 text-xs text-secondary-500">
                                  {item.subtitle && (
                                    <span className="truncate">{item.subtitle}</span>
                                  )}
                                  {status && (
                                    <span className="shrink-0 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px]">
                                      {status}
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="flex items-center justify-between border-t border-secondary-100 px-3 py-2 text-[11px] text-secondary-400">
                <span>{data?.total ?? items.length} תוצאות</span>
                <span>Enter לפתיחה · Esc לסגירה</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
