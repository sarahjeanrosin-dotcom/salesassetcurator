import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    savedSearch: { findUnique: vi.fn(), update: vi.fn() },
    salesAsset: { deleteMany: vi.fn(), createMany: vi.fn() },
    insight: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/services/web-fetcher', () => ({ fetchWebResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/youtube-fetcher', () => ({ fetchYouTubeResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/social/twitter-fetcher', () => ({ fetchTwitterResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/social/linkedin-fetcher', () => ({ fetchLinkedInResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/social/instagram-fetcher', () => ({ fetchInstagramResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/social/facebook-fetcher', () => ({ fetchFacebookResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/social/reddit-fetcher', () => ({ fetchRedditResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/classifier', () => ({ classifyResults: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/insight-generator', () => ({
  generateInsights: vi.fn().mockResolvedValue({
    contentPatterns: 'patterns',
    primarySellFocus: 'focus',
    audienceProfile: 'audience',
  }),
}));

import { runSearch } from '@/services/search-orchestrator';
import { prisma } from '@/lib/prisma';
import { fetchWebResults } from '@/services/web-fetcher';
import { fetchYouTubeResults } from '@/services/youtube-fetcher';
import { classifyResults } from '@/services/classifier';

const mp = vi.mocked(prisma);

const BASE_SEARCH = {
  id: 'search-1',
  companyName: 'Acme',
  constraints: {},
  status: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastRunAt: null,
};

function setupHappyPath(overrides: Partial<typeof BASE_SEARCH> = {}) {
  const search = { ...BASE_SEARCH, ...overrides };
  mp.savedSearch.findUnique.mockResolvedValue(search);
  mp.savedSearch.update.mockResolvedValue(search);
  mp.salesAsset.deleteMany.mockResolvedValue({ count: 0 });
  mp.insight.deleteMany.mockResolvedValue({ count: 0 });
  mp.salesAsset.createMany.mockResolvedValue({ count: 0 });
  mp.insight.create.mockResolvedValue({} as never);
  return search;
}

describe('runSearch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when the search record does not exist', async () => {
    mp.savedSearch.findUnique.mockResolvedValue(null);
    await expect(runSearch('missing')).rejects.toThrow('Search missing not found');
  });

  it('marks status RUNNING before fetching, then COMPLETED on success', async () => {
    setupHappyPath();
    await runSearch('search-1');

    const calls = mp.savedSearch.update.mock.calls;
    expect(calls[0]?.[0]).toMatchObject({ data: { status: 'RUNNING' } });
    expect(calls[calls.length - 1]?.[0]).toMatchObject({ data: { status: 'COMPLETED' } });
  });

  it('marks status FAILED when a downstream service throws', async () => {
    setupHappyPath();
    vi.mocked(classifyResults).mockRejectedValueOnce(new Error('classifier down'));

    await expect(runSearch('search-1')).rejects.toThrow();

    const updateCalls = mp.savedSearch.update.mock.calls;
    expect(updateCalls.some((c) => c[0]?.data?.status === 'FAILED')).toBe(true);
  });

  it('clears previous assets and insights before running', async () => {
    setupHappyPath();
    await runSearch('search-1');

    expect(mp.salesAsset.deleteMany).toHaveBeenCalledWith({ where: { searchId: 'search-1' } });
    expect(mp.insight.deleteMany).toHaveBeenCalledWith({ where: { searchId: 'search-1' } });
  });

  it('skips fetchers for excluded platforms', async () => {
    setupHappyPath({ constraints: { excludePlatforms: ['web', 'youtube'] } });
    await runSearch('search-1');

    expect(fetchWebResults).not.toHaveBeenCalled();
    expect(fetchYouTubeResults).not.toHaveBeenCalled();
  });

  it('persists only assets whose contentType matches the constraint', async () => {
    setupHappyPath({ constraints: { contentTypes: ['white_paper'] } });
    vi.mocked(classifyResults).mockResolvedValueOnce([
      { url: 'https://a.com/guide.pdf', title: 'Guide', platform: 'web', contentType: 'white_paper', summary: '' },
      { url: 'https://a.com/blog', title: 'Blog', platform: 'web', contentType: 'blog_post', summary: '' },
    ]);

    await runSearch('search-1');

    const createArg = mp.salesAsset.createMany.mock.calls[0]?.[0];
    expect(createArg?.data).toHaveLength(1);
    expect(createArg?.data[0]?.contentType).toBe('white_paper');
  });

  it('persists all assets when no contentTypes constraint is set', async () => {
    setupHappyPath();
    vi.mocked(classifyResults).mockResolvedValueOnce([
      { url: 'https://a.com/a', title: 'A', platform: 'web', contentType: 'article', summary: '' },
      { url: 'https://a.com/b', title: 'B', platform: 'web', contentType: 'video', summary: '' },
    ]);

    await runSearch('search-1');

    const createArg = mp.salesAsset.createMany.mock.calls[0]?.[0];
    expect(createArg?.data).toHaveLength(2);
  });

  it('still completes when an individual fetcher rejects (allSettled)', async () => {
    setupHappyPath();
    vi.mocked(fetchWebResults).mockRejectedValueOnce(new Error('web down'));

    await expect(runSearch('search-1')).resolves.toBeUndefined();

    const updateCalls = mp.savedSearch.update.mock.calls;
    expect(updateCalls[updateCalls.length - 1]?.[0]).toMatchObject({ data: { status: 'COMPLETED' } });
  });

  it('skips createMany when no assets pass classification', async () => {
    setupHappyPath();
    // classifyResults already returns [] by default
    await runSearch('search-1');
    expect(mp.salesAsset.createMany).not.toHaveBeenCalled();
  });
});
