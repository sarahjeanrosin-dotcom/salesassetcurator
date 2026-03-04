import axios from 'axios';
import type { RawResult, SearchConstraints } from '@/types';

interface TwitterTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    impression_count?: number;
  };
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
}

export async function fetchTwitterResults(
  companyName: string,
  constraints: SearchConstraints,
): Promise<RawResult[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) return [];

  const query = buildQuery(companyName, constraints);

  try {
    const params: Record<string, string> = {
      query,
      max_results: '100',
      'tweet.fields': 'created_at,public_metrics',
    };
    if (constraints.dateFrom) params['start_time'] = new Date(constraints.dateFrom).toISOString();
    if (constraints.dateTo) params['end_time'] = new Date(constraints.dateTo).toISOString();

    const res = await axios.get<TwitterSearchResponse>(
      'https://api.twitter.com/2/tweets/search/recent',
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params,
      },
    );

    return (res.data.data ?? []).map((tweet) => ({
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      title: tweet.text.slice(0, 100),
      snippet: tweet.text,
      platform: 'twitter' as const,
      publishedAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count,
      comments: tweet.public_metrics?.reply_count,
      impressions: tweet.public_metrics?.impression_count,
    }));
  } catch {
    return [];
  }
}

function buildQuery(companyName: string, constraints: SearchConstraints): string {
  let q = `"${companyName}" -is:retweet lang:en`;
  if (constraints.excludeKeywords?.length) {
    q += ' ' + constraints.excludeKeywords.map((kw) => `-"${kw}"`).join(' ');
  }
  return q;
}
