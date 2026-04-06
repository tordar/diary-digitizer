import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const books = await db.book.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { entries: true, pages: true } },
    },
  })
  return NextResponse.json(books)
}

export async function POST(req: NextRequest) {
  const { name, dateRange } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const book = await db.book.create({ data: { name, dateRange } })
  return NextResponse.json(book, { status: 201 })
}
