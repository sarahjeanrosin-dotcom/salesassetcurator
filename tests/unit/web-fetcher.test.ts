import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import { fetchWebResults } from '@/services/web-fetcher';

const mockPost = vi.mocked(axios.post);

const makeSerperResponse = (links: string[]) => ({
  data: {
    organic: links.map((link) => ({
      title: `Page at ${link}`,
      link,
      snippet: `Snippet for ${link}`,
    })),
  },
});

describe('fetchWebResults', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, SERPER_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns empty array and skips axios when SERPER_API_KEY is absent', async () => {
    delete process.env.SERPER_API_KEY;
    const results = await fetchWebResults('Acme', {});
    expect(results).toEqual([]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('maps Serper organic results to RawResult with platform=web', async () => {
    mockPost.mockResolvedValue(makeSerperResponse(['https://acme.com/blog']));
    const results = await fetchWebResults('Acme', {});
    const blog = results.find((r) => r.url === 'https://acme.com/blog');
    expect(blog).toBeDefined();
    expect(blog?.platform).toBe('web');
    expect(blog?.title).toBe('Page at https://acme.com/blog');
  });

  it('deduplicates the same URL returned by multiple queries', async () => {
    // Every query returns the same URL
    mockPost.mockResolvedValue(makeSerperResponse(['https://acme.com/shared']));
    const results = await fetchWebResults('Acme', {});
    const count = results.filter((r) => r.url === 'https://acme.com/shared').length;
    expect(count).toBe(1);
  });

  it('includes correctly formatted tbs param when date range is provided', async () => {
    mockPost.mockResolvedValue({ data: { organic: [] } });
    await fetchWebResults('Acme', { dateFrom: '2024-01-15', dateTo: '2024-12-31' });
    const firstBody = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(firstBody['tbs']).toBe('cdr:1,cd_min:01/15/2024,cd_max:12/31/2024');
  });

  it('omits tbs param when only one of dateFrom/dateTo is provided', async () => {
    mockPost.mockResolvedValue({ data: { organic: [] } });
    await fetchWebResults('Acme', { dateFrom: '2024-01-01' });
    const firstBody = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(firstBody['tbs']).toBeUndefined();
  });

  it('filters out results matching excludeKeywords', async () => {
    mockPost.mockResolvedValue(
      makeSerperResponse(['https://acme.com/careers', 'https://acme.com/product']),
    );
    const results = await fetchWebResults('Acme', { excludeKeywords: ['careers'] });
    expect(results.some((r) => r.url === 'https://acme.com/careers')).toBe(false);
    expect(results.some((r) => r.url === 'https://acme.com/product')).toBe(true);
  });

  it('returns partial results when some queries fail', async () => {
    mockPost
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue(makeSerperResponse(['https://acme.com/ok']));
    const results = await fetchWebResults('Acme', {});
    expect(Array.isArray(results)).toBe(true);
    expect(results.some((r) => r.url === 'https://acme.com/ok')).toBe(true);
  });

  it('sends num=20 in every request body', async () => {
    mockPost.mockResolvedValue({ data: { organic: [] } });
    await fetchWebResults('Acme', {});
    for (const call of mockPost.mock.calls) {
      const body = call[1] as Record<string, unknown>;
      expect(body['num']).toBe(20);
    }
  });
});
