import type { ReactNode } from 'react';

import { cn } from './cn';

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  rowKey: (row: T) => string;
  caption?: string;
  loading?: boolean;
  /** Rendered instead of the table when loading (e.g. Skeleton rows). */
  loadingSlot?: ReactNode;
  /** Rendered instead of the table when there are no rows. */
  emptySlot?: ReactNode;
  /** Rendered instead of the table on error. */
  errorSlot?: ReactNode;
  footer?: ReactNode;
}

/** Responsive table with caller-provided loading, empty, and error slots. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  loadingSlot,
  emptySlot,
  errorSlot,
  footer,
}: DataTableProps<T>) {
  if (errorSlot) {
    return <>{errorSlot}</>;
  }
  if (loading) {
    return <>{loadingSlot}</>;
  }
  if (rows.length === 0) {
    return <>{emptySlot}</>;
  }

  return (
    <div>
      <div className="hidden overflow-hidden rounded-xl border border-glass-border sm:block">
        <table className="w-full text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="border-b border-glass-border bg-glass-20 text-xs uppercase tracking-wider text-ink/60">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.header ?? index}
                  scope="col"
                  className={cn('px-4 py-3 font-medium', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors hover:bg-glass-20"
              >
                {columns.map((column, index) => (
                  <td
                    key={column.header ?? index}
                    className={cn('px-4 py-3 align-middle', column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="glass-panel p-4">
            <dl className="space-y-2.5">
              {columns.map((column, index) => (
                <div
                  key={column.header ?? index}
                  className="flex flex-col gap-1"
                >
                  <dt className="text-xs uppercase tracking-wider text-ink/50">
                    {column.header}
                  </dt>
                  <dd className="text-sm">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
