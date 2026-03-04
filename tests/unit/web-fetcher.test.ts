import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import { fetchWebResults, discoverCompanyDomain } from '@/services/web-fetcher';

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

describe('discoverCompanyDomain', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, SERPER_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the most common non-third-party domain', async () => {
    mockPost.mockResolvedValueOnce(
      makeSerperResponse([
        'https://www.getgenea.com/',
        'https://www.getgenea.com/webinars/',
        'https://www.getgenea.com/blog/',
        'https://linkedin.com/company/genea',
      ]),
    );
    const domain = await discoverCompanyDomain('Genea');
    expect(domain).toBe('getgenea.com');
  });

  it('ignores known third-party domains', async () => {
    mockPost.mockResolvedValueOnce(
      makeSerperResponse([
        'https://linkedin.com/company/acme',
        'https://twitter.com/acme',
        'https://www.acme.com/',
      ]),
    );
    const domain = await discoverCompanyDomain('Acme');
    expect(domain).toBe('acme.com');
  });

  it('returns null when all results are third-party', async () => {
    mockPost.mockResolvedValueOnce(
      makeSerperResponse([
        'https://linkedin.com/company/acme',
        'https://g2.com/products/acme',
      ]),
    );
    const domain = await discoverCompanyDomain('Acme');
    expect(domain).toBeNull();
  });

  it('returns null when no API key', async () => {
    delete process.env.SERPER_API_KEY;
    const domain = await discoverCompanyDomain('Acme');
    expect(domain).toBeNull();
  });
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
    // First call = discoverCompanyDomain, rest = queries
    mockPost.mockResolvedValue(makeSerperResponse(['https://acme.com/blog']));
    const results = await fetchWebResults('Acme', {});
    const blog = results.find((r) => r.url === 'https://acme.com/blog');
    expect(blog).toBeDefined();
    expect(blog?.platform).toBe('web');
  });

  it('deduplicates the same URL returned by multiple queries', async () => {
    mockPost.mockResolvedValue(makeSerperResponse(['https://acme.com/shared']));
    const results = await fetchWebResults('Acme', {});
    const count = results.filter((r) => r.url === 'https://acme.com/shared').length;
    expect(count).toBe(1);
  });

  it('includes correctly formatted tbs param when date range is provided', async () => {
    mockPost.mockResolvedValue({ data: { organic: [] } });
    await fetchWebResults('Acme', { dateFrom: '2024-01-15', dateTo: '2024-12-31' });
    // Skip first call (domain discovery, no date filter), check a broad query call
    const broadCall = mockPost.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(broadCall['tbs']).toBe('cdr:1,cd_min:01/15/2024,cd_max:12/31/2024');
  });

  it('omits tbs param when only one of dateFrom/dateTo is provided', async () => {
    mockPost.mockResolvedValue({ data: { organic: [] } });
    await fetchWebResults('Acme', { dateFrom: '2024-01-01' });
    const broadCall = mockPost.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(broadCall['tbs']).toBeUndefined();
  });

  it('issues site-specific queries when a domain is discovered', async () => {
    // domain discovery returns acme.com
    mockPost
      .mockResolvedValueOnce(makeSerperResponse(['https://www.acme.com/']))
      .mockResolvedValue({ data: { organic: [] } });

    await fetchWebResults('Acme', {});

    const queries = mockPost.mock.calls.map((c) => (c[1] as Record<string, unknown>)['q']);
    expect(queries.some((q) => typeof q === 'string' && q.startsWith('site:acme.com'))).toBe(true);
  });

  it('skips site-specific queries when domain cannot be discovered', async () => {
    // All discovery results are third-party
    mockPost
      .mockResolvedValueOnce(makeSerperResponse(['https://linkedin.com/company/acme']))
      .mockResolvedValue({ data: { organic: [] } });

    await fetchWebResults('Acme', {});

    const queries = mockPost.mock.calls.map((c) => (c[1] as Record<string, unknown>)['q']);
    expect(queries.every((q) => typeof q !== 'string' || !q.startsWith('site:acme.com'))).toBe(true);
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
