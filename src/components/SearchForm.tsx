'use client';

import { useState } from 'react';
import type { ContentType, Platform, SearchConstraints } from '@/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'reddit', label: 'Reddit' },
];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'article', label: 'Article' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'white_paper', label: 'White Paper' },
  { value: 'ebook', label: 'eBook' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'webinar_recording', label: 'Webinar Recording' },
  { value: 'video', label: 'Video' },
  { value: 'podcast_episode', label: 'Podcast Episode' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'press_release', label: 'Press Release' },
  { value: 'product_page', label: 'Product Page' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'one_pager', label: 'One-Pager' },
  { value: 'slide_deck', label: 'Slide Deck' },
  { value: 'infographic', label: 'Infographic' },
];

interface SearchFormProps {
  onSearchCreated: (searchId: string) => void;
}

export function SearchForm({ onSearchCreated }: SearchFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [excludePlatforms, setExcludePlatforms] = useState<Platform[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function togglePlatform(platform: Platform) {
    setExcludePlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function toggleContentType(ct: ContentType) {
    setContentTypes((prev) =>
      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setLoading(true);

    const constraints: SearchConstraints = {};
    if (dateFrom) constraints.dateFrom = dateFrom;
    if (dateTo) constraints.dateTo = dateTo;
    if (excludePlatforms.length > 0) constraints.excludePlatforms = excludePlatforms;
    if (contentTypes.length > 0) constraints.contentTypes = contentTypes;
    if (excludeKeywords.trim()) {
      constraints.excludeKeywords = excludeKeywords.split(',').map((kw) => kw.trim()).filter(Boolean);
    }

    try {
      const res = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim(), constraints }),
      });
      const data = (await res.json()) as { id: string };
      onSearchCreated(data.id);
      setCompanyName('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">New Search</h2>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Company name</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Salesforce"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mb-4 text-xs text-brand-600 underline"
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced filters
      </button>

      {showAdvanced && (
        <div className="mb-4 space-y-4 rounded-lg bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Published after</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Published before</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Exclude keywords (comma-separated)</label>
            <input
              type="text"
              value={excludeKeywords}
              onChange={(e) => setExcludeKeywords(e.target.value)}
              placeholder="competitor, internal, draft"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">Exclude platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    excludePlatforms.includes(p.value)
                      ? 'border-red-300 bg-red-100 text-red-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {excludePlatforms.includes(p.value) ? `✕ ${p.label}` : p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">
              Only show content types (leave empty for all)
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => toggleContentType(ct.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    contentTypes.includes(ct.value)
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !companyName.trim()}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Starting search…' : 'Find content'}
      </button>
    </form>
  );
}
