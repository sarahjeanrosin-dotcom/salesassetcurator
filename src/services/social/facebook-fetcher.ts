import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

/**
 * Meta Graph API — requires a Page access token.
 * Falls back to Google CSE scoped to facebook.com.
 */
export async function fetchFacebookResults(
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
    const searchRes = await axios.get<{ data?: Array<{ id: string; name: string }> }>(
      'https://graph.facebook.com/v19.0/pages/search',
      { params: { q: companyName, access_token: accessToken, fields: 'id,name' } },
    );
    const page = searchRes.data.data?.[0];
    if (!page) return [];

    const postsRes = await axios.get<{
      data?: Array<{
        id: string;
        message?: string;
        story?: string;
        created_time?: string;
        permalink_url?: string;
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }>;
    }>(`https://graph.facebook.com/v19.0/${page.id}/posts`, {
      params: {
        access_token: accessToken,
        fields: 'id,message,story,created_time,permalink_url,reactions.summary(true),comments.summary(true),shares',
        limit: 50,
      },
    });

    return (postsRes.data.data ?? []).map((post) => ({
      url: post.permalink_url ?? `https://www.facebook.com/${post.id}`,
      title: (post.message ?? post.story ?? '').slice(0, 100),
      snippet: post.message ?? post.story ?? '',
      platform: 'facebook' as const,
      publishedAt: post.created_time,
      likes: post.reactions?.summary?.total_count,
      comments: post.comments?.summary?.total_count,
      shares: post.shares?.count,
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
      { params: { key: apiKey, cx: cseId, q: `"${companyName}" site:facebook.com`, num: 10 } },
    );
    return (res.data.items ?? [])
      .filter((item) => !constraints.excludeKeywords?.some((kw) =>
        `${item.title} ${item.snippet}`.toLowerCase().includes(kw.toLowerCase()),
      ))
      .map((item) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        platform: 'facebook' as const,
      }));
  } catch {
    return [];
  }
}
