'use client';

import { useState, useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { SalesAsset, ContentType, Platform } from '@/types';

const columnHelper = createColumnHelper<SalesAsset>();

const PLATFORM_LABELS: Record<Platform, string> = {
  web: 'Web',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  reddit: 'Reddit',
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: 'Article',
  blog_post: 'Blog Post',
  landing_page: 'Landing Page',
  white_paper: 'White Paper',
  ebook: 'eBook',
  case_study: 'Case Study',
  webinar: 'Webinar',
  webinar_recording: 'Webinar Recording',
  video: 'Video',
  podcast_episode: 'Podcast',
  social_post: 'Social Post',
  press_release: 'Press Release',
  product_page: 'Product Page',
  one_pager: 'One-Pager',
  slide_deck: 'Slide Deck',
  infographic: 'Infographic',
  other: 'Other',
};

function fmt(n: number | undefined): string {
  if (n === undefined) return '—';
  return n.toLocaleString();
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

interface ResultsTableProps {
  assets: SalesAsset[];
}

export function ResultsTable({ assets }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'publishedAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <a
            href={info.row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            {info.getValue()}
          </a>
        ),
        enableColumnFilter: true,
      }),
      columnHelper.accessor('platform', {
        header: 'Platform',
        cell: (info) => PLATFORM_LABELS[info.getValue()] ?? info.getValue(),
        enableColumnFilter: true,
      }),
      columnHelper.accessor('contentType', {
        header: 'Content Type',
        cell: (info) => CONTENT_TYPE_LABELS[info.getValue()] ?? info.getValue(),
        enableColumnFilter: true,
      }),
      columnHelper.accessor('publishedAt', {
        header: 'Published',
        cell: (info) => fmtDate(info.getValue()),
        sortingFn: 'datetime',
      }),
      columnHelper.accessor('views', {
        header: 'Views',
        cell: (info) => fmt(info.getValue() ?? undefined),
        sortingFn: (a, b) => (a.original.views ?? -1) - (b.original.views ?? -1),
      }),
      columnHelper.accessor('likes', {
        header: 'Likes',
        cell: (info) => fmt(info.getValue() ?? undefined),
        sortingFn: (a, b) => (a.original.likes ?? -1) - (b.original.likes ?? -1),
      }),
      columnHelper.accessor('comments', {
        header: 'Comments',
        cell: (info) => fmt(info.getValue() ?? undefined),
        sortingFn: (a, b) => (a.original.comments ?? -1) - (b.original.comments ?? -1),
      }),
      columnHelper.accessor('summary', {
        header: 'AI Summary',
        cell: (info) => (
          <span className="text-xs text-gray-600">{info.getValue() ?? '—'}</span>
        ),
        enableSorting: false,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: assets,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (assets.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No assets found.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {table.getFilteredRowModel().rows.length} of {assets.length} assets
        </p>
        <input
          type="text"
          placeholder="Search all columns…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'flex cursor-pointer select-none items-center gap-1' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
                            {{ asc: '↑', desc: '↓' }[header.column.getIsSorted() as string] ?? '↕'}
                          </span>
                        )}
                      </div>
                    )}
                    {header.column.getCanFilter() && (
                      <input
                        type="text"
                        placeholder="Filter…"
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => header.column.setFilterValue(e.target.value)}
                        className="mt-1 w-full rounded border border-gray-200 px-2 py-0.5 text-xs font-normal normal-case tracking-normal focus:outline-none focus:ring-1 focus:ring-brand-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="max-w-xs px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
