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

// Domains that are never the company's own site
const THIRD_PARTY_DOMAINS = new Set([
  'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'reddit.com', 'wikipedia.org', 'bloomberg.com', 'forbes.com',
  'techcrunch.com', 'g2.com', 'capterra.com', 'trustpilot.com', 'glassdoor.com',
  'indeed.com', 'crunchbase.com', 'pitchbook.com', 'prnewswire.com',
  'businesswire.com', 'globenewswire.com', 'slideshare.net', 'speakerdeck.com',
  'vimeo.com', 'medium.com', 'substack.com',
]);

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

/**
 * Searches for the company name without quotes to get a broad result set,
 * then picks the most-frequently-appearing non-third-party domain.
 * Returns null if no domain can be identified.
 */
export async function discoverCompanyDomain(companyName: string): Promise<string | null> {
  const results = await executeQuery(companyName);
  const counts = new Map<string, number>();

  for (const r of results) {
    try {
      const hostname = new URL(r.url).hostname.replace(/^www\./, '');
      if (!THIRD_PARTY_DOMAINS.has(hostname)) {
        counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
      }
    } catch {
      // ignore malformed URLs
    }
  }

  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function fetchWebResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const q = `"${companyName}"`;

  // Phase 1: discover the company's own domain so we can query it directly
  const domain = await discoverCompanyDomain(companyName);

  // Phase 2: broad web queries (mentions across the internet)
  const broadQueries = [
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

  // Phase 3: site-specific queries — crawl the company's own domain directly
  // These reliably surface pages like /webinars/, /blog/, /resources/ etc.
  const siteQueries: string[] = domain
    ? [
        `site:${domain}`,
        `site:${domain} webinar`,
        `site:${domain} blog`,
        `site:${domain} resources OR resource-center`,
        `site:${domain} "case study"`,
        `site:${domain} filetype:pdf`,
        `site:${domain} ebook`,
        `site:${domain} podcast`,
        `site:${domain} pricing`,
      ]
    : [];

  const allQueries = [...broadQueries, ...siteQueries];

  const results = await Promise.all(
    allQueries.map((query) => executeQuery(query, constraints.dateFrom, constraints.dateTo)),
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
