# CLAUDE.md — Sales Asset Curator

This file provides guidance for AI assistants (Claude and others) working in this repository.
Update this file whenever new patterns, dependencies, or conventions are introduced.

---

## Project Overview

**Sales Asset Curator** is a micro-app that discovers, classifies, and surfaces insights about
a company's client-facing content across the web, social media, and YouTube.

A user enters a company name and optional constraints, then triggers an AI-powered search. The AI
finds all public-facing sales and marketing content, classifies it, attaches available metrics and
engagement data, and generates meaningful insights about content patterns, messaging, and audience.

---

## User Stories

### Backend

- The AI searches **web, social (LinkedIn, Twitter/X, Instagram, Facebook, Reddit), and YouTube**
  for client-facing content tied to a specified business.
- Content is **classified by type** (article, video, social post, landing page, etc.)
  and **by location** (platform/URL).
- Where available, the AI attaches **metrics** (views, impressions) and **engagement** (comments,
  likes, shares). Fields are omitted — not shown as zero — when data is unavailable.
- The AI **continues searching until all sources are found** (exhaustive, not just top results).
- Web search must use **targeted query variants** to surface long-form assets: e.g.
  `"[company]" filetype:pdf` for white papers, `"[company]" webinar` for webinars,
  `"[company]" site:slideshare.net` for slide decks.
- The AI generates **insights**: patterns in the content, what is primarily being sold,
  and who the apparent audience is.
- Searches run **in the background** — the user triggers a search and is notified when it completes.

### Frontend

- User enters a **company name** and sets **search constraints**:
  - Date range (published after / before)
  - Content type filter (e.g. only videos, only articles)
  - Platform filter (exclude specific platforms)
  - Keywords to exclude
- A **button** triggers the AI search (async — runs in background).
- Results are displayed in a **table** with all classification elements as columns.
- An **AI insights panel** presents patterns, selling focus, and audience analysis.
- The AI uses insights to **learn about the content, product, and audience** within the session.
- Users can **save searches** and return to them later.
  - When reopening a saved search: show cached results with a **Refresh button** to re-run.
- **MVP**: single user, no authentication. Architecture must support multi-user sign-in in later iterations.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | TypeScript (strict) | All source files |
| Runtime | Node.js LTS | |
| AI provider | Anthropic Claude API | Powers search orchestration, classification, and insight generation |
| Web search | Google Custom Search API | Requires `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` |
| YouTube | YouTube Data API v3 | Requires `YOUTUBE_API_KEY` |
| Social | Per-platform APIs | LinkedIn, Twitter/X, Instagram, Facebook, Reddit (see API notes below) |
| Background jobs | To be decided | BullMQ (Redis-backed) or similar for async search runs |
| Database | To be decided | PostgreSQL preferred — stores saved searches, results, classifications |
| ORM | To be decided | Prisma preferred |
| Framework | To be decided | Next.js (full-stack) or Express + React |
| Testing | Vitest | Unit + integration |
| Linting | ESLint + Prettier | |
| Package manager | npm or pnpm | Lockfile must be committed |

### Social Platform API Notes

Each platform has distinct API constraints — handle rate limits and auth per-platform:

| Platform | API / Method | Notes |
|----------|-------------|-------|
| LinkedIn | LinkedIn Marketing API | Company pages and posts |
| Twitter/X | X API v2 | Search recent/full-archive tweets |
| Instagram | Instagram Graph API | Business account content only |
| Facebook | Meta Graph API | Public page content |
| Reddit | Reddit API (PRAW or REST) | Subreddit search, brand mentions |

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                   Frontend                   │
│  Search form → Results table → Insights panel│
│  Saved searches list + Refresh button        │
└────────────────┬────────────────────────────┘
                 │ REST / WebSocket
┌────────────────▼────────────────────────────┐
│                 API Layer                    │
│  POST /searches     – create search job      │
│  GET  /searches/:id – poll or subscribe      │
│  GET  /searches     – list saved searches    │
└────────────────┬────────────────────────────┘
                 │ Enqueue job
┌────────────────▼────────────────────────────┐
│              Background Job Queue            │
│  SearchOrchestrator runs per saved search    │
│  Spawns sub-tasks per source (web/YT/social) │
└──┬─────────────┬────────────────┬───────────┘
   │             │                │
┌──▼──┐    ┌────▼────┐    ┌──────▼──────┐
│ Web │    │ YouTube │    │   Social    │
│Fetcher│  │ Fetcher │    │  Fetchers   │
└──┬──┘    └────┬────┘    └──────┬──────┘
   └─────────────┴───────────────┘
                 │ Raw results
┌────────────────▼────────────────────────────┐
│          Claude API (Anthropic)              │
│  • Classify content type + location          │
│  • Extract available metrics + engagement    │
│  • Generate insights (patterns/audience/     │
│    selling focus)                            │
└────────────────┬────────────────────────────┘
                 │ Structured data
┌────────────────▼────────────────────────────┐
│              Database (PostgreSQL)           │
│  searches, results, classifications,         │
│  insights, users (future)                   │
└─────────────────────────────────────────────┘
```

---

## Directory Structure (target)

```
salesassetcurator/
├── src/
│   ├── services/
│   │   ├── search-orchestrator.ts   # Coordinates all fetchers for a search job
│   │   ├── web-fetcher.ts           # Google Custom Search API integration
│   │   ├── youtube-fetcher.ts       # YouTube Data API integration
│   │   ├── social/
│   │   │   ├── linkedin-fetcher.ts
│   │   │   ├── twitter-fetcher.ts
│   │   │   ├── instagram-fetcher.ts
│   │   │   ├── facebook-fetcher.ts
│   │   │   └── reddit-fetcher.ts
│   │   ├── classifier.ts            # Claude API: classify + extract metrics
│   │   └── insight-generator.ts     # Claude API: generate pattern/audience insights
│   ├── jobs/
│   │   └── search-job.ts            # Background job definition
│   ├── routes/ or pages/
│   │   ├── searches.ts              # CRUD for searches
│   │   └── results.ts               # Fetch results for a search
│   ├── db/
│   │   ├── schema.prisma            # Prisma schema
│   │   └── migrations/
│   ├── types/
│   │   ├── asset.ts                 # SalesAsset, Classification, Metrics, Engagement
│   │   ├── search.ts                # SearchJob, SearchConstraints, SearchStatus
│   │   └── insight.ts              # Insight, ContentPattern
│   └── lib/
│       ├── claude-client.ts         # Anthropic SDK wrapper
│       ├── google-search-client.ts  # Google CSE wrapper
│       └── queue.ts                 # Job queue setup
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── CLAUDE.md
```

---

## Core Data Model

### Content Types

The `ContentType` enum must cover web-sourced long-form assets in addition to social and video:

```typescript
type ContentType =
  | 'article'
  | 'blog_post'
  | 'landing_page'
  | 'white_paper'       // Downloadable PDF/doc research or thought leadership
  | 'ebook'             // Long-form downloadable guide
  | 'case_study'        // Customer success story
  | 'webinar'           // Live or recorded online presentation (web or YouTube)
  | 'webinar_recording' // On-demand replay hosted on web or YouTube
  | 'video'             // General video (YouTube, Vimeo, embedded)
  | 'podcast_episode'   // Audio/video podcast
  | 'social_post'       // LinkedIn, Twitter/X, Facebook, Instagram, Reddit post
  | 'press_release'
  | 'product_page'
  | 'one_pager'
  | 'slide_deck'        // SlideShare, embedded presentation
  | 'infographic'
  | 'other';
```

Webinars and white papers are **first-class content types**. The web fetcher must use targeted
queries to surface them (e.g. `site:example.com filetype:pdf`, `"webinar" "company name"`).

### Results Table — Columns and Sorting

The results table must support **sorting and filtering on every column**. Default sort: `publishedAt` descending.

| Column | Type | Sortable | Filterable |
|--------|------|----------|------------|
| Title | string | yes | keyword search |
| Platform | enum | yes | multi-select |
| Content Type | enum | yes | multi-select |
| Published Date | date | yes | date range |
| URL / Source | string | no | — |
| Views | number | yes | range |
| Engagement | number (total) | yes | range |
| AI Summary | string | no | keyword search |

When a metric cell has no data, render an em dash (`—`), not `0`.

---

## Core Data Model

```typescript
// A piece of discovered client-facing content
interface SalesAsset {
  id: string;
  searchId: string;
  url: string;
  title: string;
  platform: Platform;                  // 'web' | 'youtube' | 'linkedin' | 'twitter' | ...
  contentType: ContentType;            // see ContentType definition above
  publishedAt?: Date;
  metrics?: {                          // Only populated when data is available
    views?: number;
    impressions?: number;
  };
  engagement?: {                       // Only populated when data is available
    comments?: number;
    likes?: number;
    shares?: number;
  };
  summary?: string;                    // Claude-generated summary of the content
  createdAt: Date;
}

// User-defined search parameters
interface SearchConstraints {
  dateFrom?: Date;
  dateTo?: Date;
  contentTypes?: ContentType[];        // Filter to specific content types
  excludePlatforms?: Platform[];       // Platforms to skip
  excludeKeywords?: string[];          // Keywords that disqualify a result
}

// A saved search
interface SavedSearch {
  id: string;
  companyName: string;
  constraints: SearchConstraints;
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastRunAt?: Date;
  createdAt: Date;
}

// AI-generated insight for a completed search
interface Insight {
  searchId: string;
  contentPatterns: string;             // Recurring themes/formats observed
  primarySellFocus: string;            // What the content is primarily selling
  audienceProfile: string;             // Who the apparent audience is
  generatedAt: Date;
}
```

**Key rule:** Metrics and engagement fields must be `undefined` (not `null` or `0`) when no data
exists. The UI renders `—` (em dash) in the table cell when the value is undefined — never `0`.

---

## Environment Variables

All required variables must be documented in `.env.example`. Never commit secrets.

```bash
# AI
ANTHROPIC_API_KEY=

# Web Search
GOOGLE_API_KEY=
GOOGLE_CSE_ID=

# YouTube
YOUTUBE_API_KEY=

# Social APIs
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TWITTER_BEARER_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
FACEBOOK_ACCESS_TOKEN=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Database
DATABASE_URL=postgres://user:password@localhost:5432/salesassetcurator

# Queue (if Redis-backed)
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=development
PORT=3000
```

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev

# Run background worker (if separate process)
npm run worker

# Run tests
npm test

# Lint
npm run lint

# Build
npm run build
```

### Branch Strategy

- `main` — production-ready; never commit directly
- `claude/<description>-<session-id>` — AI-assisted branches
- `feature/<short-description>` — human-initiated features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — non-functional changes

### Commit Messages (Conventional Commits)

```
feat(search): add Reddit fetcher with subreddit search
fix(classifier): handle missing engagement data gracefully
chore(deps): upgrade Anthropic SDK to latest
```

---

## Code Conventions

- **TypeScript strict mode** — no `any`; use `unknown` when type is genuinely unknown
- Prefer `interface` over `type` for object shapes
- Named exports only — no default exports
- All async functions must handle errors explicitly
- Files: `kebab-case.ts` — Components: `PascalCase.tsx` — Constants: `SCREAMING_SNAKE_CASE`
- Business logic lives in `src/services/` — never in routes or components
- Metrics/engagement fields: use `undefined` to mean "not available", never `0` or `null`

---

## Testing Requirements

- All `src/services/` logic must have unit tests
- API routes must have integration tests
- Minimum coverage: **80%** (enforced in CI)
- Tests runnable with `npm test` after `.env` setup
- When fixing a bug: write a failing test first, then fix

---

## AI Assistant Guidelines

When working in this codebase:

1. Read this file and any `README.md` before making changes
2. Never push to `main` — use a `claude/` or `feature/` branch
3. Never commit `.env` files with real secrets
4. Write tests for all new service/utility logic
5. Keep PRs focused — one concern per commit/PR
6. Run `npm run lint && npm test` before pushing
7. Update this file when new patterns or decisions are introduced
8. Metrics/engagement: always check whether data exists before populating — never fabricate zeroes
9. Claude API calls: keep prompts in `src/services/classifier.ts` and `src/services/insight-generator.ts`; do not scatter raw API calls throughout the codebase
10. When adding a new social platform fetcher, follow the pattern in `src/services/social/` and register it in `src/services/search-orchestrator.ts`

---

## Future Considerations (post-MVP)

- Multi-user authentication (OAuth / email+password)
- Per-user saved search isolation
- Scheduled auto-refresh of saved searches
- CSV / PDF export of results table
- Webhook notifications when background search completes
- Rate limit handling and retry strategies per social platform

---

*Last updated: 2026-03-04 — populated with user stories and initial architecture decisions*
