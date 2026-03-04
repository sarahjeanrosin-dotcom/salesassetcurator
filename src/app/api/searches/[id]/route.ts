import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/searches/:id — get a search with its assets and insight
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const search = await prisma.savedSearch.findUnique({
    where: { id },
    include: { assets: { orderBy: { publishedAt: 'desc' } }, insight: true },
  });

  if (!search) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(search);
}

// DELETE /api/searches/:id — remove a saved search and all its data
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.savedSearch.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
