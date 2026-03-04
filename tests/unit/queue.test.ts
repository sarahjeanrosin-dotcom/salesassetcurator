import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/search-orchestrator', () => ({
  runSearch: vi.fn().mockResolvedValue(undefined),
}));

import { enqueueSearch } from '@/lib/queue';
import { runSearch } from '@/services/search-orchestrator';

describe('enqueueSearch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls runSearch with the provided searchId', async () => {
    enqueueSearch('abc-123');
    await vi.waitFor(() => expect(runSearch).toHaveBeenCalledWith('abc-123'));
  });

  it('returns void synchronously (fire-and-forget)', () => {
    const result = enqueueSearch('abc-123');
    expect(result).toBeUndefined();
  });

  it('does not throw when runSearch rejects', async () => {
    vi.mocked(runSearch).mockRejectedValueOnce(new Error('search failed'));
    expect(() => enqueueSearch('bad-id')).not.toThrow();
    // Let the rejected promise settle without an unhandled rejection
    await new Promise((r) => setTimeout(r, 10));
  });
});
