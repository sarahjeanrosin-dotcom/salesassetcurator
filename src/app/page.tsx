'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { SavedSearchesList } from '@/components/SavedSearchesList';
import { ResultsTable } from '@/components/ResultsTable';
import { InsightsPanel } from '@/components/InsightsPanel';
import { StatusBadge } from '@/components/StatusBadge';
import type { SavedSearch, SalesAsset, Insight, SearchStatus } from '@/types';

interface SearchListItem extends SavedSearch {
  _count: { assets: number };
}

interface SearchDetail extends SavedSearch {
  assets: SalesAsset[];
  insight?: Insight;
}

const POLL_INTERVAL_MS = 4000;

export default function HomePage() {
  const [searches, setSearches] = useState<SearchListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState<SearchDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved searches list
  const loadSearches = useCallback(async () => {
    const res = await fetch('/api/searches');
    const data = (await res.json()) as SearchListItem[];
    setSearches(data);
  }, []);

  // Load a specific search with results
  const loadSearch = useCallback(async (id: string) => {
    const res = await fetch(`/api/searches/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as SearchDetail;
    setActiveSearch(data);
    // Update the status in the sidebar list
    setSearches((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: data.status, _count: { assets: data.assets.length } } : s,
      ),
    );
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  // Poll active search while it is PENDING or RUNNING
  useEffect(() => {
    if (!activeId) return;
    const running = (['PENDING', 'RUNNING'] as SearchStatus[]).includes(
      activeSearch?.status ?? 'COMPLETED',
    );
    if (!running) return;

    const timer = setInterval(() => loadSearch(activeId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeId, activeSearch?.status, loadSearch]);

  function handleSearchCreated(id: string) {
    setActiveId(id);
    loadSearches();
    loadSearch(id);
  }

  function handleSelect(id: string) {
    setActiveId(id);
    loadSearch(id);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/searches/${id}`, { method: 'DELETE' });
    if (activeId === id) {
      setActiveId(null);
      setActiveSearch(null);
    }
    loadSearches();
  }

  async function handleRefresh() {
    if (!activeId) return;
    setRefreshing(true);
    await fetch(`/api/searches/${activeId}/refresh`, { method: 'POST' });
    await loadSearch(activeId);
    setRefreshing(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <SearchForm onSearchCreated={handleSearchCreated} />
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Saved Searches</h2>
          <SavedSearchesList
            searches={searches}
            activeId={activeId}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>
      </aside>

      {/* Main content */}
      <section className="space-y-6">
        {activeSearch ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{activeSearch.companyName}</h2>
                <p className="text-sm text-gray-500">
                  {activeSearch.assets.length} assets found
                  {activeSearch.lastRunAt
                    ? ` · last run ${new Date(activeSearch.lastRunAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={activeSearch.status} />
                {activeSearch.status === 'COMPLETED' || activeSearch.status === 'FAILED' ? (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Running state */}
            {(activeSearch.status === 'PENDING' || activeSearch.status === 'RUNNING') && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
                <div className="mb-2 text-2xl">🔍</div>
                <p className="text-sm font-medium text-blue-800">Searching across all sources…</p>
                <p className="mt-1 text-xs text-blue-600">
                  This may take a minute. Results will appear automatically.
                </p>
              </div>
            )}

            {/* Insights */}
            {activeSearch.insight && <InsightsPanel insight={activeSearch.insight} />}

            {/* Results table */}
            {activeSearch.assets.length > 0 && (
              <ResultsTable assets={activeSearch.assets} />
            )}

            {/* Failed state */}
            {activeSearch.status === 'FAILED' && activeSearch.assets.length === 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm font-medium text-red-800">Search failed.</p>
                <p className="mt-1 text-xs text-red-600">
                  Check your API keys and try refreshing.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
            <p className="text-sm text-gray-400">
              Enter a company name and click &quot;Find content&quot; to get started
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
