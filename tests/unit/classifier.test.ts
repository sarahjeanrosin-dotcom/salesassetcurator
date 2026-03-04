import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK before importing classifier
vi.mock('@/lib/claude-client', () => ({
  claude: {
    messages: {
      create: vi.fn(),
    },
  },
  CLASSIFY_MODEL: 'test-model',
  INSIGHTS_MODEL: 'test-model',
}));

import { classifyResults } from '@/services/classifier';
import { claude } from '@/lib/claude-client';

describe('classifyResults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for empty input', async () => {
    const result = await classifyResults([]);
    expect(result).toEqual([]);
  });

  it('classifies assets from Claude response', async () => {
    vi.mocked(claude.messages.create).mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { index: 0, contentType: 'white_paper', summary: 'A guide to enterprise security.' },
          ]),
        },
      ],
    } as Awaited<ReturnType<typeof claude.messages.create>>);

    const results = await classifyResults([
      {
        url: 'https://example.com/security-guide.pdf',
        title: 'Enterprise Security Guide',
        snippet: 'Download our comprehensive security guide.',
        platform: 'web',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.contentType).toBe('white_paper');
    expect(results[0]?.summary).toBe('A guide to enterprise security.');
  });

  it('falls back to "other" when Claude returns invalid JSON', async () => {
    vi.mocked(claude.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
    } as Awaited<ReturnType<typeof claude.messages.create>>);

    const results = await classifyResults([
      { url: 'https://example.com', title: 'Test', snippet: 'Snippet', platform: 'web' },
    ]);

    expect(results[0]?.contentType).toBe('other');
  });

  it('falls back gracefully when Claude throws', async () => {
    vi.mocked(claude.messages.create).mockRejectedValueOnce(new Error('API error'));

    const results = await classifyResults([
      { url: 'https://example.com', title: 'Test', snippet: 'Snippet', platform: 'web' },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.contentType).toBe('other');
  });
});
