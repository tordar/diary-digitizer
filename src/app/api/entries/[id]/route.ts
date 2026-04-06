import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@/lib/db'

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

  const exists = await db.entry.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = ['title', 'date', 'entryType', 'status'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  if ('correctedText' in body) {
    await db.transcription.upsert({
      where: { entryId: id },
      create: { entryId: id, rawText: body.correctedText ?? '', correctedText: body.correctedText },
      update: { correctedText: body.correctedText },
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

  // Validate date if provided
  if ('date' in data) {
    const parsed = new Date(data.date as string)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
    }
    data.date = parsed
  }

  try {
    const entry = await db.entry.update({
      where: { id },
      data,
      include: { transcription: true, metadata: true },
    })
    return NextResponse.json(entry)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
