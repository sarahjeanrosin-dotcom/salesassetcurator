import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

/**
 * LinkedIn's public API heavily restricts content search without OAuth.
 * This fetcher uses the LinkedIn UGC Posts API with a pre-authorized access token.
 * For MVP, we fall back to Google CSE scoped to linkedin.com.
 */
export async function fetchLinkedInResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (accessToken) {
    return fetchViaLinkedInApi(companyName, constraints, accessToken);
  }

  // Fallback: Google CSE scoped to linkedin.com
  return fetchViaGoogleCse(companyName, constraints);
}

async function fetchViaLinkedInApi(
  companyName: string,
  _constraints: SearchConstraints,
  accessToken: string,
): Promise<RawResult[]> {
  try {
    const res = await axios.get<{ elements?: Array<{ id: string; specificContent?: unknown }> }>(
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(companyName)})&count=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return (res.data.elements ?? []).map((post) => ({
      url: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${post.id}`,
      title: `LinkedIn post by ${companyName}`,
      snippet: JSON.stringify(post.specificContent ?? '').slice(0, 300),
      platform: 'linkedin' as const,
    }));
  } catch {
    return [];
  }
}

async function fetchViaGoogleCse(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return [];

  try {
    const res = await axios.get<{ items?: Array<{ title: string; link: string; snippet: string }> }>(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: apiKey,
          cx: cseId,
          q: `"${companyName}" site:linkedin.com`,
          num: 10,
        },
      },
    );
    return (res.data.items ?? [])
      .filter((item) => !constraints.excludeKeywords?.some((kw) =>
        `${item.title} ${item.snippet}`.toLowerCase().includes(kw.toLowerCase()),
      ))
      .map((item) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        platform: 'linkedin' as const,
      }));
  } catch {
    return [];
  }
}
