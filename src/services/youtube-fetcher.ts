import { google } from 'googleapis';
import type { RawResult, SearchConstraints } from '@/types';

const youtube = google.youtube('v3');

export async function fetchYouTubeResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const queries = [companyName, `${companyName} webinar`, `${companyName} product demo`];
  const results: RawResult[] = [];

  for (const q of queries) {
    try {
      const params: Parameters<typeof youtube.search.list>[0] = {
        key: apiKey,
        part: ['snippet'],
        q,
        type: ['video'],
        maxResults: 25,
      };
      if (constraints.dateFrom) params.publishedAfter = new Date(constraints.dateFrom).toISOString();
      if (constraints.dateTo) params.publishedBefore = new Date(constraints.dateTo).toISOString();

      const res = await youtube.search.list(params);
      const items = res.data.items ?? [];

      // Get video stats in a single batch request
      const ids = items.map((i) => i.id?.videoId).filter(Boolean) as string[];
      let statsMap: Record<string, { views?: number; comments?: number; likes?: number }> = {};

      if (ids.length > 0) {
        const statsRes = await youtube.videos.list({
          key: apiKey,
          part: ['statistics'],
          id: ids,
        });
        statsMap = Object.fromEntries(
          (statsRes.data.items ?? []).map((v) => [
            v.id,
            {
              views: v.statistics?.viewCount ? parseInt(v.statistics.viewCount, 10) : undefined,
              comments: v.statistics?.commentCount
                ? parseInt(v.statistics.commentCount, 10)
                : undefined,
              likes: v.statistics?.likeCount ? parseInt(v.statistics.likeCount, 10) : undefined,
            },
          ]),
        );
      }

      for (const item of items) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;
        const stats = statsMap[videoId] ?? {};
        results.push({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: item.snippet?.title ?? '',
          snippet: item.snippet?.description ?? '',
          platform: 'youtube',
          publishedAt: item.snippet?.publishedAt ?? undefined,
          views: stats.views,
          comments: stats.comments,
          likes: stats.likes,
        });
      }
    } catch {
      // Continue with other queries if one fails
    }
  }

  return dedupeByUrl(applyConstraints(results, constraints));
}

function dedupeByUrl(results: RawResult[]): RawResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function applyConstraints(results: RawResult[], constraints: SearchConstraints): RawResult[] {
  return results.filter((r) => {
    if (constraints.excludeKeywords?.length) {
      const text = `${r.title} ${r.snippet}`.toLowerCase();
      if (constraints.excludeKeywords.some((kw) => text.includes(kw.toLowerCase()))) return false;
    }
    return true;
  });
}
