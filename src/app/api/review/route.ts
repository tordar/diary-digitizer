import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [entries, total] = await Promise.all([
    db.entry.findMany({
      where: { status: 'pending_review' },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        book: { select: { id: true, name: true } },
        pages: { select: { id: true, filePath: true, pageOrder: true }, orderBy: { pageOrder: 'asc' } },
        transcription: true,
        metadata: true,
      },
    }),
    db.entry.count({ where: { status: 'pending_review' } }),
  ])
  return NextResponse.json({ entries, total })
}
