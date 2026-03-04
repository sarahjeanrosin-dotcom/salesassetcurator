'use client';

import clsx from 'clsx';
import type { SearchStatus } from '@/types';

const CONFIG: Record<SearchStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  RUNNING: { label: 'Running…', className: 'bg-blue-100 text-blue-800 animate-pulse' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status }: { status: SearchStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}
