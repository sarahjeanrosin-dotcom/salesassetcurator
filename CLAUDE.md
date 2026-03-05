# CLAUDE.md — Sales Asset Curator

This file provides guidance for AI assistants (Claude and others) working in this repository.
Update this file whenever new patterns, dependencies, or conventions are introduced.

---

## Project Overview

**Sales Asset Curator** is a full-stack Next.js micro-app that discovers, classifies, and surfaces
insights about a company's client-facing content across the web, social media, and YouTube.

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
| Language | TypeScript 5.7 (strict) | All source files |
| Runtime | Node.js LTS | |
| Framework | Next.js 15.1 (App Router) | Full-stack — routes + React frontend |
| AI provider | Anthropic Claude API | Haiku 4.5 for classification; Sonnet 4.6 for insights |
| Web search | Serper API | Requires `SERPER_API_KEY` — replaces Google CSE |
| YouTube | YouTube Data API v3 | Requires `YOUTUBE_API_KEY` |
| Social | Per-platform APIs | LinkedIn, Twitter/X, Instagram+Facebook (Meta), Reddit |
| Background jobs | Fire-and-forget (`src/lib/queue.ts`) | Same-process async; swap for BullMQ+Redis at scale |
| Database | PostgreSQL | Via `DATABASE_URL` |
| ORM | Prisma 5.22 | Schema at `prisma/schema.prisma` |
| Frontend tables | @tanstack/react-table 8 | Sorting + filtering |
| Styling | Tailwind CSS 3.4 | Brand color: sky-500 (#0ea5e9) |
| Testing | Vitest 2.1 | Unit + integration; 80% coverage threshold enforced |
| Linting | ESLint 9 + Prettier 3.4 | |
| Package manager | npm | `package-lock.json` committed |

### Claude Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Content classification | `claude-haiku-4-5-20251001` | Fast, cost-effective; batched in groups of 50 |
| Insight generation | `claude-sonnet-4-6` | Higher quality for pattern/audience analysis |

### Social Platform API Notes

Each platform has distinct API constraints — handle rate limits and auth per-platform:

| Platform | API / Method | Fallback |
|----------|-------------|----------|
| LinkedIn | LinkedIn UGC Posts API (`LINKEDIN_ACCESS_TOKEN`) | Google CSE scoped to linkedin.com |
| Twitter/X | X API v2 recent search (`TWITTER_BEARER_TOKEN`) | None |
| Instagram | Meta Graph API (`META_ACCESS_TOKEN`) | Google CSE scoped to instagram.com |
| Facebook | Meta Graph API (`META_ACCESS_TOKEN`) | Google CSE scoped to facebook.com |
| Reddit | Reddit OAuth REST API (`REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`) | None |

> **Note:** LinkedIn, Instagram, and Facebook fetchers silently fall back to Google CSE when their
> primary API credentials are missing. This allows partial results without hard failures.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                   Frontend                   │
│  src/app/page.tsx (polls every 4 seconds)    │
│  SearchForm → ResultsTable → InsightsPanel   │
│  SavedSearchesList + Refresh button          │
└────────────────┬────────────────────────────┘
                 │ fetch() — REST
┌────────────────▼────────────────────────────┐
│          API Layer (Next.js Route Handlers)  │
│  POST /api/searches     – create + enqueue   │
│  GET  /api/searches     – list all           │
│  GET  /api/searches/:id – fetch with assets  │
│  DELETE /api/searches/:id – remove           │
│  POST /api/searches/:id/refresh – re-run     │
└────────────────┬────────────────────────────┘
                 │ enqueueSearch() – fire-and-forget
┌────────────────▼────────────────────────────┐
│          src/lib/queue.ts                    │
│  Calls runSearch() in same process async     │
│  No Redis — swap for BullMQ at scale         │
└────────────────┬────────────────────────────┘
                 │ runSearch()
┌────────────────▼────────────────────────────┐
│     src/services/search-orchestrator.ts      │
│  Marks RUNNING → fetches in parallel →       │
│  classifies (batches of 50) → filters →      │
│  persists → generates insights → COMPLETED   │
└──┬─────────────┬────────────────┬───────────┘
   │             │                │
┌──▼──────┐ ┌───▼──────┐ ┌───────▼────────────┐
│web-     │ │youtube-  │ │social/             │
│fetcher  │ │fetcher   │ │  linkedin-fetcher  │
│(Serper) │ │(YT API)  │ │  twitter-fetcher   │
└──┬──────┘ └───┬──────┘ │  instagram-fetcher │
   │            │        │  facebook-fetcher  │
   │            │        │  reddit-fetcher    │
   └────────────┴────────┴─────────┐
                                   │ RawResult[]
              ┌────────────────────▼────────────────┐
              │  src/services/classifier.ts          │
              │  Claude Haiku — assigns contentType  │
              │  + generates summary per item        │
              └────────────────────┬────────────────┘
                                   │ ClassifiedResult[]
              ┌────────────────────▼────────────────┐
              │  src/services/insight-generator.ts   │
              │  Claude Sonnet — contentPatterns,    │
              │  primarySellFocus, audienceProfile   │
              └────────────────────┬────────────────┘
                                   │ Insight
              ┌────────────────────▼────────────────┐
              │         PostgreSQL (Prisma)          │
              │  SavedSearch, SalesAsset, Insight    │
              └─────────────────────────────────────┘
```

---

## Directory Structure (actual)

```
salesassetcurator/
├── prisma/
│   └── schema.prisma            # Prisma schema + migration history
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout with header
│   │   ├── page.tsx             # Main page — polling, search selection
│   │   ├── globals.css          # Tailwind directives
│   │   └── api/
│   │       └── searches/
│   │           ├── route.ts              # GET (list), POST (create)
│   │           └── [id]/
│   │               ├── route.ts          # GET (fetch), DELETE
│   │               └── refresh/route.ts  # POST (re-run)
│   ├── components/              # React client components
│   │   ├── SearchForm.tsx
│   │   ├── ResultsTable.tsx     # @tanstack/react-table
│   │   ├── InsightsPanel.tsx
│   │   ├── SavedSearchesList.tsx
│   │   └── StatusBadge.tsx
│   ├── services/                # All business logic lives here
│   │   ├── search-orchestrator.ts
│   │   ├── classifier.ts        # Claude Haiku — classification + summaries
│   │   ├── insight-generator.ts # Claude Sonnet — pattern/audience insights
│   │   ├── web-fetcher.ts       # Serper API integration
│   │   ├── youtube-fetcher.ts   # YouTube Data API v3
│   │   └── social/
│   │       ├── linkedin-fetcher.ts
│   │       ├── twitter-fetcher.ts
│   │       ├── instagram-fetcher.ts
│   │       ├── facebook-fetcher.ts
│   │       └── reddit-fetcher.ts
│   ├── lib/
│   │   ├── claude-client.ts     # Anthropic SDK singleton
│   │   ├── prisma.ts            # Prisma singleton (safe for Next.js HMR)
│   │   └── queue.ts             # Fire-and-forget enqueuer
│   └── types/
│       └── index.ts             # All enums + interfaces in one file
├── tests/
│   ├── unit/
│   │   ├── classifier.test.ts
│   │   ├── search-orchestrator.test.ts
│   │   ├── web-fetcher.test.ts
│   │   ├── insight-generator.test.ts
│   │   └── queue.test.ts
│   └── integration/
│       └── searches-route.test.ts
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts             # 80% coverage threshold
└── CLAUDE.md
```

---

## Core Data Model

### Enums

```typescript
// Defined in src/types/index.ts

type SearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

type Platform =
  | 'web'
  | 'youtube'
  | 'linkedin'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'reddit';

type ContentType =
  | 'article'
  | 'blog_post'
  | 'landing_page'
  | 'white_paper'        // Downloadable PDF/doc — first-class type
  | 'ebook'
  | 'case_study'
  | 'webinar'            // Live or upcoming — first-class type
  | 'webinar_recording'  // On-demand replay
  | 'video'              // General video
  | 'podcast_episode'
  | 'social_post'
  | 'press_release'
  | 'product_page'
  | 'one_pager'
  | 'slide_deck'         // SlideShare, embedded presentations
  | 'infographic'
  | 'other';
```

Webinars and white papers are **first-class content types**. The web fetcher uses targeted queries
to surface them (e.g. `site:example.com filetype:pdf`, `"webinar" "company name"`).

### Interfaces

```typescript
// A piece of discovered client-facing content
interface SalesAsset {
  id: string;
  searchId: string;
  url: string;
  title: string;
  platform: Platform;
  contentType: ContentType;
  publishedAt?: Date;
  metrics?: {                   // Only populated when API data is available
    views?: number;
    impressions?: number;
  };
  engagement?: {                // Only populated when API data is available
    comments?: number;
    likes?: number;
    shares?: number;
  };
  summary?: string;             // Claude-generated summary
  createdAt: Date;
}

// User-defined search parameters
interface SearchConstraints {
  dateFrom?: Date;
  dateTo?: Date;
  contentTypes?: ContentType[];    // Post-classification filter
  excludePlatforms?: Platform[];   // Skipped at orchestrator level
  excludeKeywords?: string[];      // Applied in web-fetcher before returning
}

// A saved search (DB model)
interface SavedSearch {
  id: string;
  companyName: string;
  constraints: SearchConstraints;  // Stored as JSON in DB
  status: SearchStatus;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// AI-generated insight for a completed search
interface Insight {
  id: string;
  searchId: string;               // unique — one insight per search
  contentPatterns: string;
  primarySellFocus: string;
  audienceProfile: string;
  generatedAt: Date;
}
```

**Key rule:** Metrics and engagement fields must be `undefined` (not `null` or `0`) when no data
exists. The UI renders `—` (em dash) in table cells when a value is undefined — never `0`.

### Prisma Schema Summary

```
model SavedSearch {
  id          String       @id @default(cuid())
  companyName String
  constraints Json         // SearchConstraints serialized
  status      SearchStatus @default(PENDING)
  lastRunAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  assets      SalesAsset[]
  insight     Insight?
}

model SalesAsset {
  id          String      @id @default(cuid())
  searchId    String
  url         String
  title       String
  platform    Platform
  contentType ContentType
  publishedAt DateTime?
  views       Int?
  impressions Int?
  comments    Int?
  likes       Int?
  shares      Int?
  summary     String?
  createdAt   DateTime    @default(now())
  search      SavedSearch @relation(...)
  @@index([searchId])
}

model Insight {
  id               String      @id @default(cuid())
  searchId         String      @unique
  contentPatterns  String
  primarySellFocus String
  audienceProfile  String
  generatedAt      DateTime    @default(now())
  search           SavedSearch @relation(...)
}
```

---

## Service Layer Details

### `search-orchestrator.ts` — `runSearch(searchId)`

1. Fetch search from DB; throw if not found.
2. Mark search `RUNNING`, clear prior assets + insight.
3. Run all fetchers in parallel with `Promise.allSettled` (respects `excludePlatforms`).
4. Aggregate `RawResult[]` from settled promises (log + skip failed fetchers).
5. Pass to `classifyResults()` in batches of 50.
6. Apply `contentTypes` filter (post-classification, not pre-fetch).
7. Persist `SalesAsset` records via `createMany({ skipDuplicates: true })`.
8. Generate insights from up to 200 assets via `generateInsights()`.
9. Mark search `COMPLETED`; mark `FAILED` on any unhandled error.

### `classifier.ts` — `classifyResults(results)`

- Model: `claude-haiku-4-5-20251001` (fast, cost-effective).
- Batches input in groups of 50 to manage token limits.
- Returns `contentType` + `summary` for each item.
- On JSON parse failure or API error: returns `{ contentType: 'other', summary: snippet }`.

### `insight-generator.ts` — `generateInsights(assets)`

- Model: `claude-sonnet-4-6` (higher quality analysis).
- Takes up to 200 classified assets in compact form.
- Returns `{ contentPatterns, primarySellFocus, audienceProfile }`.
- On empty asset list or API failure: returns descriptive fallback strings.

### `web-fetcher.ts` — Serper API

- Discovers company domain via initial broad query.
- Runs targeted queries: blog, articles, landing pages, white papers (`filetype:pdf`),
  webinars, case studies, ebooks, slide decks, infographics, podcasts, press releases.
- Runs site-specific query: `site:domain` for direct domain crawling.
- Applies `excludeKeywords` filter before returning results.
- Deduplicates by URL across all query results.

### `youtube-fetcher.ts` — YouTube Data API v3

- Queries: company name, `"{company}" webinar`, `"{company}" product demo`.
- Fetches video stats: viewCount, commentCount, likeCount.

### Social Fetchers — Common Pattern

Each social fetcher in `src/services/social/`:
1. Attempts primary API using env-var credentials.
2. Falls back to Google CSE scoped to the platform domain when credentials are absent.
3. Returns `RawResult[]` (empty array if both paths fail).
4. When adding a new platform, register the fetcher in `search-orchestrator.ts`.

---

## API Layer

### Endpoints

| Method | Path | File | Action |
|--------|------|------|--------|
| GET | `/api/searches` | `src/app/api/searches/route.ts` | List all searches with asset count |
| POST | `/api/searches` | `src/app/api/searches/route.ts` | Create search + enqueue |
| GET | `/api/searches/:id` | `src/app/api/searches/[id]/route.ts` | Fetch search + assets + insight |
| DELETE | `/api/searches/:id` | `src/app/api/searches/[id]/route.ts` | Delete (cascades to assets + insight) |
| POST | `/api/searches/:id/refresh` | `src/app/api/searches/[id]/refresh/route.ts` | Re-enqueue existing search |

### Route Handler Pattern

Route handlers must be thin — delegate all business logic to `src/services/`:

```typescript
// Good
export async function POST(req: Request) {
  const body = await req.json();
  const search = await createSearch(body);
  enqueueSearch(search.id);   // fire-and-forget
  return NextResponse.json(search, { status: 201 });
}

// Bad — business logic in route handler
export async function POST(req: Request) {
  const body = await req.json();
  const search = await prisma.savedSearch.create({ ... });
  // do not run orchestration logic here
}
```

---

## Frontend

### Polling Strategy

`src/app/page.tsx` polls `GET /api/searches/:id` every **4 seconds** while
`status === 'PENDING' || status === 'RUNNING'`. Polling stops when `COMPLETED` or `FAILED`.

### Results Table Columns

Default sort: `publishedAt` descending. All columns sortable; rendered with `@tanstack/react-table`.

| Column | Sortable | Notes |
|--------|----------|-------|
| Title (link to URL) | yes | |
| Platform | yes | |
| Content Type | yes | |
| Published Date | yes | |
| Views | yes | `—` when undefined |
| Likes | yes | `—` when undefined |
| Comments | yes | `—` when undefined |
| AI Summary | no | |

### Em Dash Rule

```tsx
// Correct — never render 0 for missing data
{asset.metrics?.views !== undefined ? asset.metrics.views.toLocaleString() : '—'}
```

---

## Environment Variables

All variables must be in `.env.example`. Never commit real secrets or `.env` files.

```bash
# AI
ANTHROPIC_API_KEY=

# Web Search (Serper — replaces Google CSE)
SERPER_API_KEY=

# YouTube
YOUTUBE_API_KEY=

# Social APIs
TWITTER_BEARER_TOKEN=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ACCESS_TOKEN=        # Required for LinkedIn primary API
META_ACCESS_TOKEN=            # Shared by Instagram + Facebook fetchers
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=salesassetcurator/0.1.0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salesassetcurator

# App
NODE_ENV=development
PORT=3000
```

> **Note:** `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` are used by the LinkedIn, Instagram, and Facebook
> fallback fetchers when primary API credentials are unavailable. They are optional but recommended.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start dev server (Next.js)
npm run dev

# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Lint
npm run lint

# Type-check
npx tsc --noEmit

# Build for production
npm run build
```

> **No separate worker process.** Background search jobs run in the same Next.js process via
> fire-and-forget. To scale, replace `src/lib/queue.ts` with BullMQ + Redis.

---

## Testing

### Structure

```
tests/
├── unit/
│   ├── classifier.test.ts            # 3 tests — batch classification, fallback
│   ├── insight-generator.test.ts     # 3 tests — empty input, parse, fallback
│   ├── queue.test.ts                 # 3 tests — fire-and-forget behavior
│   ├── search-orchestrator.test.ts   # 8 tests — status transitions, constraints
│   └── web-fetcher.test.ts           # 11 tests — domain discovery, dedup, filters
└── integration/
    └── searches-route.test.ts        # 14 tests — all 5 API endpoints
```

### Coverage Threshold

`vitest.config.ts` enforces **80% coverage** on lines, functions, branches, and statements.
The CI pipeline will fail if coverage drops below this threshold.

### Mocking Strategy

- Prisma: mocked at `src/lib/prisma.ts` module level
- Anthropic SDK: mocked via `vi.mock('@anthropic-ai/sdk')`
- HTTP clients (axios, Serper, social APIs): mocked with `vi.mock('axios')`
- All fetchers: mocked in orchestrator tests (not tested for real API calls)

### When Fixing a Bug

1. Write a **failing test** that reproduces the bug.
2. Fix the bug.
3. Confirm the test passes.
4. Run full suite: `npm test`.

---

## Code Conventions

- **TypeScript strict mode** — no `any`; use `unknown` when type is genuinely unknown
- Prefer `interface` over `type` for object shapes
- **Named exports only** — no default exports in any file
- All async functions must handle errors explicitly (no uncaught promise rejections)
- Files: `kebab-case.ts` — Components: `PascalCase.tsx` — Constants: `SCREAMING_SNAKE_CASE`
- Business logic lives in `src/services/` — never in routes or components
- Metrics/engagement fields: use `undefined` to mean "not available", never `0` or `null`
- Claude API prompts belong only in `src/services/classifier.ts` and
  `src/services/insight-generator.ts` — no scattered raw API calls elsewhere

---

## Branch Strategy

- `main` — production-ready; never commit directly
- `claude/<description>-<session-id>` — AI-assisted feature branches
- `feature/<short-description>` — human-initiated features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — non-functional changes

## Commit Messages (Conventional Commits)

```
feat(search): add Reddit fetcher with subreddit search
fix(classifier): handle missing engagement data gracefully
chore(deps): upgrade Anthropic SDK to latest
test(web-fetcher): add coverage for domain discovery edge cases
```

---

## AI Assistant Guidelines

When working in this codebase:

1. Read this file before making changes.
2. Never push to `main` — use a `claude/` or `feature/` branch.
3. Never commit `.env` files with real secrets.
4. Write tests for all new service/utility logic before or alongside implementation.
5. Keep PRs focused — one concern per commit/PR.
6. Run `npm run lint && npm test` before pushing.
7. Update this file when new patterns, dependencies, or decisions are introduced.
8. Metrics/engagement: always check whether data exists before populating — never fabricate zeroes.
9. Claude API calls: keep all prompts in `src/services/classifier.ts` and
   `src/services/insight-generator.ts`; do not scatter raw API calls throughout the codebase.
10. When adding a new social platform fetcher:
    - Create `src/services/social/<platform>-fetcher.ts` following existing fetcher patterns.
    - Register it in `src/services/search-orchestrator.ts`.
    - Add its env vars to `.env.example`.
    - Add unit tests in `tests/unit/`.
11. Use `claude-haiku-4-5-20251001` for classification tasks; use `claude-sonnet-4-6` for
    insight generation. Do not change models without reviewing cost and quality trade-offs.
12. The web fetcher uses the **Serper API** (`SERPER_API_KEY`), not Google CSE. Do not revert
    this or add Google CSE dependencies.

---

## Future Considerations (post-MVP)

- **BullMQ + Redis** — replace fire-and-forget queue for production-scale background jobs
- **Multi-user authentication** — OAuth or email+password; per-user search isolation
- **Scheduled auto-refresh** — cron-based re-runs of saved searches
- **CSV / PDF export** — download results table
- **Webhook notifications** — alert when a background search completes
- **Per-platform rate limit handling** — retry strategies with exponential back-off
- **WebSocket / SSE** — replace polling with server-sent events for real-time status

---

*Last updated: 2026-03-05 — updated to reflect actual implementation (Serper API, Next.js App Router,
fire-and-forget queue, Prisma schema, Claude model selection, full directory structure)*
