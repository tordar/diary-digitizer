import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const entry = await db.entry.findUnique({
    where: { id },
    include: {
      book: true,
      pages: { orderBy: { pageOrder: 'asc' } },
      transcription: true,
      metadata: true,
    },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entry)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const allowed = ['title', 'date', 'entryType', 'status'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  if ('correctedText' in body) {
    await db.transcription.update({
      where: { entryId: id },
      data: { correctedText: body.correctedText },
    })
  }

  if ('metadata' in body) {
    const { mood, topics, people, places, themes } = body.metadata
    await db.entryMetadata.upsert({
      where: { entryId: id },
      create: { entryId: id, mood, topics, people, places, themes },
      update: { mood, topics, people, places, themes },
    })
  }

  const entry = await db.entry.update({
    where: { id },
    data,
    include: { transcription: true, metadata: true },
  })

  return NextResponse.json(entry)
}
