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

// Serper expects MM/DD/YYYY; ISO dates are YYYY-MM-DD
function isoToSerperDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

async function executeQuery(query: string, dateFrom?: string, dateTo?: string): Promise<RawResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const body: Record<string, unknown> = { q: query, num: 20 };
  if (dateFrom && dateTo) {
    body['tbs'] = `cdr:1,cd_min:${isoToSerperDate(dateFrom)},cd_max:${isoToSerperDate(dateTo)}`;
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
    // Blog & articles
    `${q} blog`,
    `${q} article`,
    // Landing & product pages
    `${q} "landing page"`,
    `${q} pricing`,
    `${q} features OR solutions OR "product overview"`,
    `${q} "get started" OR "free trial" OR "sign up" OR demo`,
    // Long-form gated content
    `${q} "white paper" OR whitepaper filetype:pdf`,
    `${q} ebook filetype:pdf`,
    `${q} ebook "download"`,
    `${q} "data sheet" OR datasheet OR "one pager" OR "one-pager"`,
    // Case studies
    `${q} "case study"`,
    `${q} "customer story" OR "success story" OR "customer spotlight"`,
    // Webinars
    `${q} webinar`,
    `${q} "on-demand" webinar`,
    `${q} "register now" webinar OR "upcoming webinar"`,
    // Podcasts
    `${q} podcast`,
    // Press & news
    `${q} "press release"`,
    `${q} site:prnewswire.com`,
    `${q} site:businesswire.com`,
    // Slide decks & visual assets
    `${q} infographic`,
    `${q} site:slideshare.net`,
    `${q} site:speakerdeck.com`,
    // Video (non-YouTube)
    `${q} site:vimeo.com`,
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
