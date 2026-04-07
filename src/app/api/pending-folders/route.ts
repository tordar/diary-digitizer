import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET: return folders with awaiting_book jobs, grouped by book folderHint
export async function GET() {
  const jobs = await db.processingJob.findMany({
    where: { status: 'awaiting_book' },
    include: { page: { include: { book: true } } },
  })

  // Group by book
  const byBook = new Map<string, { bookId: string; folderHint: string | null; bookName: string; pageCount: number }>()
  for (const job of jobs) {
    const book = job.page.book
    if (!byBook.has(book.id)) {
      byBook.set(book.id, {
        bookId: book.id,
        folderHint: book.folderHint ?? null,
        bookName: book.name,
        pageCount: 0,
      })
    }
    byBook.get(book.id)!.pageCount++
  }

  return NextResponse.json({ folders: Array.from(byBook.values()) })
}

// POST: assign all awaiting_book pages in a temp book to a real book, then queue them
export async function POST(req: NextRequest) {
  const { tempBookId, targetBookId } = await req.json()

  if (!tempBookId || !targetBookId) {
    return NextResponse.json({ error: 'tempBookId and targetBookId required' }, { status: 400 })
  }

  // Reassign pages to the target book
  await db.page.updateMany({
    where: { bookId: tempBookId },
    data: { bookId: targetBookId },
  })

  // Queue the jobs
  await db.processingJob.updateMany({
    where: {
      status: 'awaiting_book',
      page: { bookId: targetBookId },
    },
    data: { status: 'queued' },
  })

  // Delete the now-empty temp book
  const remaining = await db.page.count({ where: { bookId: tempBookId } })
  if (remaining === 0) {
    await db.book.delete({ where: { id: tempBookId } })
  }

  return NextResponse.json({ ok: true })
}
