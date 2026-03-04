import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enqueueSearch } from '@/lib/queue';
import type { CreateSearchRequest } from '@/types';

// GET /api/searches — list all saved searches
export async function GET() {
  const searches = await prisma.savedSearch.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assets: true } } },
  });
  return NextResponse.json(searches);
}

// POST /api/searches — create and enqueue a new search
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateSearchRequest;

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
  }

  const search = await prisma.savedSearch.create({
    data: {
      companyName: body.companyName.trim(),
      constraints: body.constraints ?? {},
      status: 'PENDING',
    },
  });

  enqueueSearch(search.id);

  return NextResponse.json(search, { status: 201 });
}
