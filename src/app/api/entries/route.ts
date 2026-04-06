import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@/lib/db'

interface EntryFilters {
  bookId?: string
  mood?: string
  entryType?: string
  person?: string
  place?: string
  topic?: string
  dateFrom?: string
  dateTo?: string
  q?: string
  status?: string
}

export function buildEntriesWhere(filters: EntryFilters): Prisma.EntryWhereInput {
  const where: Prisma.EntryWhereInput = {
    status: (filters.status ?? 'approved') as Prisma.EntryWhereInput['status'],
  }

  if (filters.bookId) where.bookId = filters.bookId
  if (filters.entryType) where.entryType = filters.entryType as Prisma.EntryWhereInput['entryType']

  const metadataWhere: Prisma.EntryMetadataWhereInput = {}
  if (filters.mood) metadataWhere.mood = filters.mood
  if (filters.person) metadataWhere.people = { has: filters.person }
  if (filters.place) metadataWhere.places = { has: filters.place }
  if (filters.topic) metadataWhere.topics = { has: filters.topic }
  if (Object.keys(metadataWhere).length > 0) where.metadata = metadataWhere

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    }
  }

  return where
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filters: EntryFilters = {
    bookId: searchParams.get('bookId') ?? undefined,
    mood: searchParams.get('mood') ?? undefined,
    entryType: searchParams.get('entryType') ?? undefined,
    person: searchParams.get('person') ?? undefined,
    place: searchParams.get('place') ?? undefined,
    topic: searchParams.get('topic') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  }

  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const skip = (page - 1) * limit

  const where = buildEntriesWhere(filters)

  // Full-text search via raw query on tsvector
  if (filters.q) {
    const ftsResults = await db.$queryRaw<{ entry_id: string }[]>`
      SELECT t.entry_id
      FROM transcriptions t
      WHERE t.search_vector @@ plainto_tsquery('norwegian', ${filters.q})
    `
    const ids = ftsResults.map((r) => r.entry_id)
    where.id = { in: ids }
  }

  const [entries, total] = await Promise.all([
    db.entry.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        book: { select: { id: true, name: true } },
        pages: { select: { id: true, filePath: true, pageOrder: true }, orderBy: { pageOrder: 'asc' }, take: 1 },
        transcription: { select: { correctedText: true, rawText: true } },
        metadata: { select: { mood: true, topics: true, people: true, places: true } },
      },
    }),
    db.entry.count({ where }),
  ])

  return NextResponse.json({ entries, total, page, limit })
}
