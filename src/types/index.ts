// ── Enums ─────────────────────────────────────────────────────────

export type Platform =
  | 'web'
  | 'youtube'
  | 'linkedin'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'reddit';

export type ContentType =
  | 'article'
  | 'blog_post'
  | 'landing_page'
  | 'white_paper'
  | 'ebook'
  | 'case_study'
  | 'webinar'
  | 'webinar_recording'
  | 'video'
  | 'podcast_episode'
  | 'social_post'
  | 'press_release'
  | 'product_page'
  | 'one_pager'
  | 'slide_deck'
  | 'infographic'
  | 'other';

export type SearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// ── Domain models ─────────────────────────────────────────────────

export interface SalesAsset {
  id: string;
  searchId: string;
  url: string;
  title: string;
  platform: Platform;
  contentType: ContentType;
  publishedAt?: Date;
  views?: number;
  impressions?: number;
  comments?: number;
  likes?: number;
  shares?: number;
  summary?: string;
  createdAt: Date;
}

export interface SearchConstraints {
  dateFrom?: string;   // ISO date string
  dateTo?: string;     // ISO date string
  contentTypes?: ContentType[];
  excludePlatforms?: Platform[];
  excludeKeywords?: string[];
}

export interface SavedSearch {
  id: string;
  companyName: string;
  constraints: SearchConstraints;
  status: SearchStatus;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Insight {
  id: string;
  searchId: string;
  contentPatterns: string;
  primarySellFocus: string;
  audienceProfile: string;
  generatedAt: Date;
}

// ── Fetcher types ─────────────────────────────────────────────────

// Raw result before Claude classification
export interface RawResult {
  url: string;
  title: string;
  snippet: string;
  platform: Platform;
  publishedAt?: string;
  views?: number;
  impressions?: number;
  comments?: number;
  likes?: number;
  shares?: number;
}

// ── API request / response types ──────────────────────────────────

export interface CreateSearchRequest {
  companyName: string;
  constraints?: SearchConstraints;
}

export interface SearchWithAssets extends SavedSearch {
  assets: SalesAsset[];
  insight?: Insight;
}
