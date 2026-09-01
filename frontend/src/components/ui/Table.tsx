import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  total?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (newOffset: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  total,
  limit = 20,
  offset = 0,
  onPageChange,
  isLoading = false,
  emptyMessage = 'No records found.',
}: TableProps<T>) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = total ? Math.ceil(total / limit) : 1;
  const hasNextPage = total ? offset + limit < total : false;
  const hasPrevPage = offset > 0;

  return (
    <div className="w-full flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} scope="col" className={`px-6 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-6 py-4">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`px-6 py-4 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? String(item[col.accessorKey] ?? '')
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total !== undefined && total > 0 && onPageChange && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-3.5 bg-slate-950/40 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{offset + 1}</span> to{' '}
            <span className="font-semibold text-slate-200">
              {Math.min(offset + limit, total)}
            </span>{' '}
            of <span className="font-semibold text-slate-200">{total}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevPage || isLoading}
              onClick={() => onPageChange(offset - limit)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <span className="px-2 font-medium text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage || isLoading}
              onClick={() => onPageChange(offset + limit)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
