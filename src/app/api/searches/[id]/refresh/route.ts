import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchQueue } from '@/lib/queue';

// POST /api/searches/:id/refresh — re-enqueue an existing search
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const search = await prisma.savedSearch.findUnique({ where: { id } });
  if (!search) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (search.status === 'RUNNING') {
    return NextResponse.json({ error: 'Search is already running' }, { status: 409 });
  }

  await prisma.savedSearch.update({
    where: { id },
    data: { status: 'PENDING' },
  });

  await searchQueue.add('search', { searchId: id }, { attempts: 2 });

  return NextResponse.json({ queued: true });
}
