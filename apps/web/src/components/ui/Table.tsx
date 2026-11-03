'use client';

import { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, children, ...props }, ref) => (
    <div className="table-container">
      <table ref={ref} className={cn('table', className)} {...props}>
        {children}
      </table>
    </div>
  )
);

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props}>
      {children}
    </thead>
  )
);

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  )
);

TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, children, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-secondary-100 hover:bg-secondary-50/70 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
);

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, children, ...props }, ref) => (
    <th ref={ref} className={cn('px-4 py-3 text-xs font-semibold text-secondary-500 bg-secondary-50/70 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  )
);

TableHead.displayName = 'TableHead';

export interface SortableTableHeadProps
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onChange'> {
  field: string;
  activeField?: string | null;
  direction?: 'asc' | 'desc';
  onSort: (field: string) => void;
  children: ReactNode;
}

export function SortableTableHead({
  field,
  activeField,
  direction = 'desc',
  onSort,
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const active = activeField === field;
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={cn('p-0', className)} {...props}>
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'flex w-full items-center gap-1.5 px-4 py-3 text-right text-xs font-semibold transition-colors hover:text-primary-700',
          active ? 'text-primary-700' : 'text-secondary-500'
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-40')} />
      </button>
    </TableHead>
  );
}

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, children, ...props }, ref) => (
    <td ref={ref} className={cn('px-4 py-3.5 text-secondary-900', className)} {...props}>
      {children}
    </td>
  )
);

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, children, ...props }, ref) => (
    <caption ref={ref} className={cn('px-4 py-3 text-sm text-secondary-500', className)} {...props}>
      {children}
    </caption>
  )
);

TableCaption.displayName = 'TableCaption';