import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    savedSearch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    salesAsset: { deleteMany: vi.fn() },
    insight: { deleteMany: vi.fn() },
  },
}));

vi.mock('@/lib/queue', () => ({ enqueueSearch: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { enqueueSearch } from '@/lib/queue';

// Route handlers — imported after mocks are in place
import { GET as listSearches, POST as createSearch } from '@/app/api/searches/route';
import { GET as getSearch, DELETE as deleteSearch } from '@/app/api/searches/[id]/route';
import { POST as refreshSearch } from '@/app/api/searches/[id]/refresh/route';

const mp = vi.mocked(prisma);

const SAVED_SEARCH = {
  id: 'search-1',
  companyName: 'Acme',
  constraints: {},
  status: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastRunAt: null,
};

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/searches', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/searches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of searches', async () => {
    mp.savedSearch.findMany.mockResolvedValue([SAVED_SEARCH] as never);
    const res = await listSearches();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('search-1');
  });
});

describe('POST /api/searches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a search and enqueues it', async () => {
    mp.savedSearch.create.mockResolvedValue(SAVED_SEARCH as never);
    const req = makeReq('POST', { companyName: 'Acme' });
    const res = await createSearch(req);
    expect(res.status).toBe(201);
    expect(enqueueSearch).toHaveBeenCalledWith('search-1');
  });

  it('returns 400 when companyName is missing', async () => {
    const req = makeReq('POST', {});
    const res = await createSearch(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when companyName is blank whitespace', async () => {
    const req = makeReq('POST', { companyName: '   ' });
    const res = await createSearch(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/searches/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the search with assets and insight', async () => {
    mp.savedSearch.findUnique.mockResolvedValue({ ...SAVED_SEARCH, assets: [], insight: null } as never);
    const res = await getSearch(makeReq('GET'), idParams('search-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('search-1');
  });

  it('returns 404 when the search does not exist', async () => {
    mp.savedSearch.findUnique.mockResolvedValue(null);
    const res = await getSearch(makeReq('GET'), idParams('missing'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/searches/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 204 on successful deletion', async () => {
    mp.savedSearch.delete.mockResolvedValue(SAVED_SEARCH as never);
    const res = await deleteSearch(makeReq('DELETE'), idParams('search-1'));
    expect(res.status).toBe(204);
  });

  it('returns 404 when delete throws (record not found)', async () => {
    mp.savedSearch.delete.mockRejectedValue(new Error('not found'));
    const res = await deleteSearch(makeReq('DELETE'), idParams('missing'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/searches/:id/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enqueues a re-run and returns queued:true', async () => {
    mp.savedSearch.findUnique.mockResolvedValue(SAVED_SEARCH as never);
    mp.savedSearch.update.mockResolvedValue(SAVED_SEARCH as never);
    const res = await refreshSearch(makeReq('POST'), idParams('search-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queued).toBe(true);
    expect(enqueueSearch).toHaveBeenCalledWith('search-1');
  });

  it('returns 409 when search is already running', async () => {
    mp.savedSearch.findUnique.mockResolvedValue({ ...SAVED_SEARCH, status: 'RUNNING' } as never);
    const res = await refreshSearch(makeReq('POST'), idParams('search-1'));
    expect(res.status).toBe(409);
  });

  it('returns 404 when search does not exist', async () => {
    mp.savedSearch.findUnique.mockResolvedValue(null);
    const res = await refreshSearch(makeReq('POST'), idParams('missing'));
    expect(res.status).toBe(404);
  });
});
