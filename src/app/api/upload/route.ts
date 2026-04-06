import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { enqueueFile } from '@/lib/importer'

const DATA_DIR = process.env.DATA_DIR ?? './data'
const INBOX_DIR = join(DATA_DIR, 'inbox')

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  const bookId = formData.get('bookId') as string | null

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  await mkdir(INBOX_DIR, { recursive: true })

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer()
      const dest = join(INBOX_DIR, file.name)
      await writeFile(dest, Buffer.from(bytes))
      await enqueueFile(dest, INBOX_DIR, bookId ?? undefined)
      results.push({ name: file.name, ok: true })
    } catch (err) {
      results.push({ name: file.name, ok: false, error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
