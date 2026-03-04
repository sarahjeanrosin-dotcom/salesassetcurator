import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    metatags?: Array<{ 'article:published_time'?: string; 'og:type'?: string }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
}

const BASE_URL = 'https://www.googleapis.com/customsearch/v1';

async function executeQuery(query: string, dateFrom?: string, dateTo?: string): Promise<RawResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return [];

  const params: Record<string, string> = {
    key: apiKey,
    cx: cseId,
    q: query,
    num: '10',
  };

  if (dateFrom) params['dateRestrict'] = '';
  if (dateFrom && dateTo) {
    params['sort'] = `date:r:${dateFrom.replace(/-/g, '')}:${dateTo.replace(/-/g, '')}`;
  }

  try {
    const res = await axios.get<GoogleSearchResponse>(BASE_URL, { params });
    return (res.data.items ?? []).map((item) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      platform: 'web' as const,
      publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'],
    }));
  } catch {
    return [];
  }
}

export async function fetchWebResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const q = `"${companyName}"`;
  const queries = [
    q,
    `${q} whitepaper OR "white paper" filetype:pdf`,
    `${q} ebook filetype:pdf`,
    `${q} "case study"`,
    `${q} webinar`,
    `${q} "on-demand" webinar`,
    `${q} blog`,
    `${q} "press release"`,
    `${q} infographic`,
    `${q} site:slideshare.net`,
  ];

  const results = await Promise.all(
    queries.map((query) => executeQuery(query, constraints.dateFrom, constraints.dateTo)),
  );

  const all = results.flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = all.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return applyConstraints(deduped, constraints);
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
