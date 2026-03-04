import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

const SERPER_URL = 'https://google.serper.dev/search';

async function executeQuery(query: string, dateFrom?: string, dateTo?: string): Promise<RawResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const body: Record<string, unknown> = { q: query, num: 10 };
  if (dateFrom && dateTo) {
    body['tbs'] = `cdr:1,cd_min:${dateFrom},cd_max:${dateTo}`;
  }

  try {
    const res = await axios.post<SerperResponse>(SERPER_URL, body, {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    });
    return (res.data.organic ?? []).map((item) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      platform: 'web' as const,
      publishedAt: item.date,
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
