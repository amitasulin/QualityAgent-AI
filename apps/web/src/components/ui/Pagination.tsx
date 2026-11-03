'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-secondary-200 bg-secondary-50/50">
      <p className="text-sm text-secondary-500">
        מציג {from}–{to} מתוך {total}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm text-secondary-500">
            שורות בעמוד
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={disabled}
              className="rounded-lg border border-secondary-200 bg-white px-2 py-1 text-sm text-secondary-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              aria-label="מספר שורות בעמוד"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {safeTotalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={disabled || page <= 1}
              aria-label="עמוד קודם"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-secondary-500 tabular-nums">
              {page} / {safeTotalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={disabled || page >= safeTotalPages}
              aria-label="עמוד הבא"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
