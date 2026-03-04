import { claude, CLASSIFY_MODEL } from '@/lib/claude-client';
import type { ContentType, Platform, RawResult } from '@/types';

export interface ClassifiedAsset {
  url: string;
  title: string;
  platform: Platform;
  contentType: ContentType;
  publishedAt?: string;
  views?: number;
  impressions?: number;
  comments?: number;
  likes?: number;
  shares?: number;
  summary: string;
}

interface ClassificationResult {
  url: string;
  contentType: ContentType;
  summary: string;
}

const CONTENT_TYPES: ContentType[] = [
  'article', 'blog_post', 'landing_page', 'white_paper', 'ebook', 'case_study',
  'webinar', 'webinar_recording', 'video', 'podcast_episode', 'social_post',
  'press_release', 'product_page', 'one_pager', 'slide_deck', 'infographic', 'other',
];

// Claude processes up to 50 items per batch
const BATCH_SIZE = 50;

export async function classifyResults(results: RawResult[]): Promise<ClassifiedAsset[]> {
  const classified: ClassifiedAsset[] = [];

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch(batch);
    classified.push(...batchResults);
  }

  return classified;
}

async function classifyBatch(batch: RawResult[]): Promise<ClassifiedAsset[]> {
  const itemsJson = batch.map((r, idx) => ({
    index: idx,
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    platform: r.platform,
  }));

  const prompt = `You are classifying sales and marketing content for a Sales Asset Curator tool.

For each item below, determine:
1. contentType — choose exactly one from: ${CONTENT_TYPES.join(', ')}
2. summary — one sentence describing what this content is about and what it's selling or communicating

Rules:
- If URL contains "filetype:pdf" or ends in .pdf, lean toward white_paper, ebook, one_pager, or case_study
- YouTube URLs are video, webinar, or webinar_recording
- SlideShare URLs are slide_deck
- Social platform URLs are social_post
- Only classify as "other" if nothing fits

Return a JSON array with objects: { "index": number, "contentType": string, "summary": string }
Return ONLY the JSON array, no markdown, no explanation.

Items:
${JSON.stringify(itemsJson, null, 2)}`;

  try {
    const msg = await claude.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]';
    const classifications: ClassificationResult[] = parseClassifications(text, batch);

    return batch.map((raw, idx) => {
      const classification = classifications.find((c) => c.url === raw.url) ?? {
        url: raw.url,
        contentType: 'other' as ContentType,
        summary: raw.snippet.slice(0, 200),
      };
      return {
        url: raw.url,
        title: raw.title,
        platform: raw.platform,
        contentType: classification.contentType,
        publishedAt: raw.publishedAt,
        views: raw.views,
        impressions: raw.impressions,
        comments: raw.comments,
        likes: raw.likes,
        shares: raw.shares,
        summary: classification.summary,
      };
    });
  } catch {
    // Fallback: return items without classification
    return batch.map((raw) => ({
      url: raw.url,
      title: raw.title,
      platform: raw.platform,
      contentType: 'other' as ContentType,
      publishedAt: raw.publishedAt,
      views: raw.views,
      impressions: raw.impressions,
      comments: raw.comments,
      likes: raw.likes,
      shares: raw.shares,
      summary: raw.snippet.slice(0, 200),
    }));
  }
}

function parseClassifications(text: string, batch: RawResult[]): ClassificationResult[] {
  try {
    const parsed = JSON.parse(text) as Array<{
      index: number;
      contentType: string;
      summary: string;
    }>;
    return parsed.map((item) => ({
      url: batch[item.index]?.url ?? '',
      contentType: CONTENT_TYPES.includes(item.contentType as ContentType)
        ? (item.contentType as ContentType)
        : 'other',
      summary: item.summary,
    }));
  } catch {
    return [];
  }
}
