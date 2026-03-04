import { claude, INSIGHTS_MODEL } from '@/lib/claude-client';
import type { ClassifiedAsset } from './classifier';

export interface GeneratedInsight {
  contentPatterns: string;
  primarySellFocus: string;
  audienceProfile: string;
}

export async function generateInsights(assets: ClassifiedAsset[]): Promise<GeneratedInsight> {
  if (assets.length === 0) {
    return {
      contentPatterns: 'No content found to analyze.',
      primarySellFocus: 'Unable to determine — no assets found.',
      audienceProfile: 'Unable to determine — no assets found.',
    };
  }

  // Build a compact asset summary for the prompt (avoid sending full content)
  const assetSummaries = assets.slice(0, 200).map((a) => ({
    platform: a.platform,
    contentType: a.contentType,
    title: a.title,
    summary: a.summary,
    views: a.views,
    likes: a.likes,
    comments: a.comments,
  }));

  const prompt = `You are a sales intelligence analyst reviewing a company's public-facing content portfolio.

Below is a list of ${assets.length} pieces of content found across the web, YouTube, and social platforms.

Analyze this content and provide insights in the following JSON structure:
{
  "contentPatterns": "2-4 sentences describing recurring themes, formats, messaging patterns, and content strategy",
  "primarySellFocus": "2-3 sentences describing what products, services, or value propositions this company is primarily promoting",
  "audienceProfile": "2-3 sentences describing who the apparent target audience is — industry, seniority, pain points, etc."
}

Return ONLY valid JSON, no markdown, no explanation.

Content portfolio:
${JSON.stringify(assetSummaries, null, 2)}`;

  try {
    const msg = await claude.messages.create({
      model: INSIGHTS_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}';
    const parsed = JSON.parse(text) as Partial<GeneratedInsight>;

    return {
      contentPatterns: parsed.contentPatterns ?? 'Analysis unavailable.',
      primarySellFocus: parsed.primarySellFocus ?? 'Analysis unavailable.',
      audienceProfile: parsed.audienceProfile ?? 'Analysis unavailable.',
    };
  } catch {
    return {
      contentPatterns: 'Insight generation failed. Please try refreshing the search.',
      primarySellFocus: 'Insight generation failed.',
      audienceProfile: 'Insight generation failed.',
    };
  }
}
