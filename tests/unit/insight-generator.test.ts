import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/claude-client', () => ({
  claude: { messages: { create: vi.fn() } },
  CLASSIFY_MODEL: 'test-model',
  INSIGHTS_MODEL: 'test-model',
}));

import { generateInsights } from '@/services/insight-generator';
import { claude } from '@/lib/claude-client';
import type { ClassifiedAsset } from '@/services/classifier';

const ASSET: ClassifiedAsset = {
  url: 'https://example.com',
  title: 'Product overview',
  platform: 'web',
  contentType: 'landing_page',
  summary: 'Overview of the product.',
};

describe('generateInsights', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns fallback message for empty asset list', async () => {
    const result = await generateInsights([]);
    expect(result.contentPatterns).toContain('No content found');
  });

  it('parses Claude response into insight fields', async () => {
    vi.mocked(claude.messages.create).mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            contentPatterns: 'Heavy use of video content.',
            primarySellFocus: 'Enterprise SaaS platform.',
            audienceProfile: 'B2B decision makers.',
          }),
        },
      ],
    } as Awaited<ReturnType<typeof claude.messages.create>>);

    const result = await generateInsights([ASSET]);
    expect(result.contentPatterns).toBe('Heavy use of video content.');
    expect(result.primarySellFocus).toBe('Enterprise SaaS platform.');
    expect(result.audienceProfile).toBe('B2B decision makers.');
  });

  it('returns fallback on Claude error', async () => {
    vi.mocked(claude.messages.create).mockRejectedValueOnce(new Error('timeout'));
    const result = await generateInsights([ASSET]);
    expect(result.contentPatterns).toContain('failed');
  });
});
