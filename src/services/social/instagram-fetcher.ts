import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

/**
 * Instagram Graph API requires a Business/Creator page access token.
 * Without it we fall back to Google CSE scoped to instagram.com.
 */
export async function fetchInstagramResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (accessToken) {
    return fetchViaGraphApi(companyName, constraints, accessToken);
  }
  return fetchViaGoogleCse(companyName, constraints);
}

async function fetchViaGraphApi(
  companyName: string,
  _constraints: SearchConstraints,
  accessToken: string,
): Promise<RawResult[]> {
  try {
    // Search for the IG business account by name first
    const searchRes = await axios.get<{ data?: Array<{ id: string; name: string }> }>(
      'https://graph.facebook.com/v19.0/pages/search',
      { params: { q: companyName, access_token: accessToken, fields: 'id,name' } },
    );
    const page = searchRes.data.data?.[0];
    if (!page) return [];

    const mediaRes = await axios.get<{
      data?: Array<{
        id: string;
        caption?: string;
        timestamp?: string;
        like_count?: number;
        comments_count?: number;
        permalink?: string;
      }>;
    }>(`https://graph.facebook.com/v19.0/${page.id}/media`, {
      params: {
        access_token: accessToken,
        fields: 'id,caption,timestamp,like_count,comments_count,permalink',
        limit: 50,
      },
    });

    return (mediaRes.data.data ?? []).map((post) => ({
      url: post.permalink ?? `https://www.instagram.com/p/${post.id}`,
      title: (post.caption ?? '').slice(0, 100),
      snippet: post.caption ?? '',
      platform: 'instagram' as const,
      publishedAt: post.timestamp,
      likes: post.like_count,
      comments: post.comments_count,
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
      { params: { key: apiKey, cx: cseId, q: `"${companyName}" site:instagram.com`, num: 10 } },
    );
    return (res.data.items ?? [])
      .filter((item) => !constraints.excludeKeywords?.some((kw) =>
        `${item.title} ${item.snippet}`.toLowerCase().includes(kw.toLowerCase()),
      ))
      .map((item) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        platform: 'instagram' as const,
      }));
  } catch {
    return [];
  }
}
