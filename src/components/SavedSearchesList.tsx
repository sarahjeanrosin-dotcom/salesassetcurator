'use client';

import { StatusBadge } from './StatusBadge';
import type { SavedSearch } from '@/types';

interface SavedSearchesListProps {
  searches: (SavedSearch & { _count: { assets: number } })[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SavedSearchesList({ searches, activeId, onSelect, onDelete }: SavedSearchesListProps) {
  if (searches.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        No saved searches yet. Run your first search above.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {searches.map((s) => (
        <li
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
            activeId === s.id
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{s.companyName}</p>
            <p className="text-xs text-gray-400">
              {s._count.assets} assets &middot;{' '}
              {s.lastRunAt ? new Date(s.lastRunAt).toLocaleDateString() : 'not run yet'}
            </p>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <StatusBadge status={s.status} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              className="text-gray-400 hover:text-red-500"
              title="Delete search"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
