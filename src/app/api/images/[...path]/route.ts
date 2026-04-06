import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'

const DATA_DIR = process.env.DATA_DIR ?? './data'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const relPath = path.join('/')
  const absPath = resolve(join(DATA_DIR, relPath))
  const dataRoot = resolve(DATA_DIR)

  // Prevent path traversal
  if (!absPath.startsWith(dataRoot)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const buffer = await readFile(absPath)
    const ext = relPath.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
