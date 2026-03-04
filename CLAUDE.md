# CLAUDE.md — Sales Asset Curator

This file provides guidance for AI assistants (Claude and others) working in this repository.

---

## Project Overview

**Sales Asset Curator** is a tool for organizing, tagging, searching, and managing sales collateral (presentations, one-pagers, case studies, battle cards, templates, etc.). The goal is to make it easy for sales teams to find the right asset at the right time.

> **Note:** This repository was initialized on 2026-03-04 and contains no source code yet. This CLAUDE.md serves as the foundational guide for all future development.

---

## Repository Status

- **State:** Freshly initialized — no source files exist yet
- **Branch convention:** `claude/<description>-<session-id>` for AI-assisted work; `feature/<short-description>` for human-led features
- **Remote:** `sarahjeanrosin-dotcom/salesassetcurator`

---

## Intended Tech Stack (to be confirmed as development begins)

| Layer | Likely Choice | Notes |
|-------|---------------|-------|
| Runtime | Node.js (LTS) | Prefer latest LTS release |
| Language | TypeScript | Strict mode enabled |
| Framework | To be decided | Next.js or Express depending on scope |
| Database | To be decided | PostgreSQL preferred for relational asset metadata |
| Storage | To be decided | S3-compatible object storage for binary files |
| Testing | Vitest or Jest | Unit + integration tests required |
| Linting | ESLint + Prettier | Standard config |
| Package manager | npm or pnpm | Lockfile must be committed |

---

## Development Workflow

### Getting Started

```bash
# Clone and install (once package.json exists)
git clone <repo-url>
cd salesassetcurator
npm install   # or pnpm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Branch Strategy

- `main` — production-ready code; never commit directly
- `claude/<description>-<session-id>` — AI-assisted feature branches
- `feature/<short-description>` — human-initiated features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — non-functional changes (deps, config, docs)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`

Examples:
```
feat(assets): add tag-based filtering for asset search
fix(upload): handle duplicate filename collisions gracefully
docs: update CLAUDE.md with database schema notes
```

---

## Code Conventions

### TypeScript

- **Strict mode** enabled (`"strict": true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Prefer named exports over default exports
- No `any` — use `unknown` when the type is genuinely unknown
- All async functions must handle errors explicitly (no unhandled promise rejections)

### File & Directory Structure (target layout)

```
salesassetcurator/
├── src/
│   ├── components/       # UI components (if frontend present)
│   ├── lib/              # Shared utilities and helpers
│   ├── services/         # Business logic (asset ingestion, search, tagging)
│   ├── routes/ or pages/ # API routes or page components
│   ├── types/            # Shared TypeScript types and interfaces
│   └── index.ts          # Entry point
├── tests/
│   ├── unit/
│   └── integration/
├── public/               # Static assets (if applicable)
├── .env.example          # Template for required environment variables
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── CLAUDE.md
```

### Naming Conventions

- Files: `kebab-case.ts` (e.g., `asset-service.ts`)
- Components: `PascalCase.tsx` (e.g., `AssetCard.tsx`)
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase` (e.g., `SalesAsset`, `TagFilter`)

---

## Key Domain Concepts

| Term | Description |
|------|-------------|
| **Asset** | A piece of sales collateral (PDF, slide deck, video, link, etc.) |
| **Tag** | A label applied to an asset for categorization (e.g., `enterprise`, `competitor-X`) |
| **Collection** | A named, curated group of assets |
| **Owner** | The user or team responsible for keeping an asset current |
| **Version** | A revision of an asset; previous versions should be archived, not deleted |

---

## Testing Requirements

- All new business logic in `src/services/` must have unit tests
- API endpoints must have integration tests
- Minimum coverage target: **80%** (enforce via CI)
- Tests must be runnable with `npm test` without any extra setup beyond `.env` configuration

---

## Environment Variables

Document all required variables in `.env.example`. Never commit secrets.

```bash
# Example (add real vars as they are introduced)
NODE_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/salesassetcurator
STORAGE_BUCKET=my-bucket
STORAGE_ENDPOINT=https://s3.example.com
```

---

## AI Assistant Guidelines

When working in this repository, AI assistants should:

1. **Read this file first** before making any changes
2. **Check for a README.md** — if one exists it may contain more specific setup instructions
3. **Never commit directly to `main`** — always use a feature or claude branch
4. **Never commit `.env` files** containing real secrets
5. **Write tests** for all new service/utility logic
6. **Keep changes focused** — one concern per PR/commit
7. **Run the linter and tests** before pushing (`npm run lint && npm test`)
8. **Update this file** when new patterns, dependencies, or conventions are introduced

### When Adding a New Feature

1. Check `src/types/` for existing types before creating new ones
2. Place business logic in `src/services/`, not in routes or components
3. Add corresponding tests in `tests/unit/` or `tests/integration/`
4. Export public APIs from the appropriate `index.ts` barrel file

### When Fixing a Bug

1. Write a failing test that reproduces the bug first
2. Fix the bug
3. Confirm the test passes
4. Check for similar patterns elsewhere in the codebase

---

## CI/CD (to be configured)

Expected pipeline steps:
1. Install dependencies
2. Type-check (`tsc --noEmit`)
3. Lint (`eslint`)
4. Test (`npm test`)
5. Build (`npm run build`)
6. Deploy (environment-dependent)

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

*Last updated: 2026-03-04 — initial creation for empty repository*
