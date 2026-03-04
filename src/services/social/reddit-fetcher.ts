import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    created_utc: number;
    score?: number;
    num_comments?: number;
    ups?: number;
  };
}

interface RedditSearchResponse {
  data: { children: RedditPost[] };
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await axios.post<{ access_token: string }>(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: clientSecret },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': process.env.REDDIT_USER_AGENT ?? 'salesassetcurator/0.1.0',
        },
      },
    );
    return res.data.access_token;
  } catch {
    return null;
  }
}

export async function fetchRedditResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const query = buildQuery(companyName, constraints);

  try {
    const params: Record<string, string | number> = {
      q: query,
      sort: 'relevance',
      type: 'link',
      limit: 100,
    };
    if (constraints.dateFrom) {
      params['after'] = Math.floor(new Date(constraints.dateFrom).getTime() / 1000);
    }

    const res = await axios.get<RedditSearchResponse>(
      'https://oauth.reddit.com/search',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': process.env.REDDIT_USER_AGENT ?? 'salesassetcurator/0.1.0',
        },
        params,
      },
    );

    return res.data.data.children.map((post) => ({
      url: `https://www.reddit.com${post.data.permalink}`,
      title: post.data.title,
      snippet: post.data.selftext?.slice(0, 300) ?? '',
      platform: 'reddit' as const,
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      likes: post.data.ups,
      comments: post.data.num_comments,
    }));
  } catch {
    return [];
  }
}

function buildQuery(companyName: string, constraints: SearchConstraints): string {
  let q = `"${companyName}"`;
  if (constraints.excludeKeywords?.length) {
    q += ' ' + constraints.excludeKeywords.map((kw) => `-"${kw}"`).join(' ');
  }
  return q;
}
