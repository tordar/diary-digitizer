export interface InboxPathInfo {
  bookFolderHint: string | null
  isSpecial: boolean
  monthHint: string | null
}

export function parseInboxPath(relPath: string, _inboxDir: string): InboxPathInfo {
  // Normalise separators
  const parts = relPath.replace(/\\/g, '/').split('/')

  if (parts.length === 1) {
    // Flat file
    return { bookFolderHint: null, isSpecial: false, monthHint: null }
  }

  const bookFolderHint = parts[0]

  if (parts.length === 2) {
    // book/file — no month subfolder
    return { bookFolderHint, isSpecial: false, monthHint: null }
  }

  const subfolder = parts[1]
  const isSpecial = subfolder.toLowerCase() === 'special'
  const monthHint = isSpecial ? null : subfolder

  return { bookFolderHint, isSpecial, monthHint }
}

const MONTH_PATTERN = /^\[?\d+\]?\s+([A-Za-z]+)\s+(\d{2})$/

export function detectMonthHint(folderName: string): string | null {
  const match = folderName.match(MONTH_PATTERN)
  if (!match) return null
  const [, monthName, year2] = match
  const fullYear = parseInt(year2, 10) + 2000
  return `${monthName} ${fullYear}`
}

export async function enqueueFile(
  absolutePath: string,
  inboxDir: string,
  defaultBookId?: string
): Promise<void> {
  const { db } = await import('./db')
  const { hashFile } = await import('./hash')
  const { isSupported } = await import('./image')
  const { basename, relative, join, dirname } = await import('path')
  const { mkdir, copyFile, unlink } = await import('fs/promises')

  const DATA_DIR = process.env.DATA_DIR ?? './data'
  const filename = basename(absolutePath)

  if (!isSupported(filename)) {
    const rejectedPath = join(DATA_DIR, 'rejected', filename)
    await mkdir(join(DATA_DIR, 'rejected'), { recursive: true })
    await copyFile(absolutePath, rejectedPath)
    await unlink(absolutePath)
    console.warn(`[importer] Unsupported file type, moved to rejected: ${filename}`)
    return
  }

  const hash = await hashFile(absolutePath)

  // Duplicate check
  const existing = await db.page.findUnique({ where: { fileHash: hash } })
  if (existing) {
    console.log(`[importer] Duplicate skipped: ${filename}`)
    return
  }

  const relPath = relative(inboxDir, absolutePath)
  const { bookFolderHint, isSpecial, monthHint } = parseInboxPath(relPath, inboxDir)

  // Find or create book
  let bookId = defaultBookId
  if (!bookId) {
    if (bookFolderHint) {
      const book = await db.book.upsert({
        where: { folderHint: bookFolderHint },
        update: {},
        create: { name: bookFolderHint, folderHint: bookFolderHint },
      })
      bookId = book.id
    } else {
      // Flat import — assign to "Usortert" book
      const book = await db.book.upsert({
        where: { folderHint: '__unsorted__' },
        update: {},
        create: { name: 'Usortert', folderHint: '__unsorted__' },
      })
      bookId = book.id
    }
  }

  const page = await db.page.create({
    data: {
      bookId,
      filePath: absolutePath,
      originalPath: absolutePath,
      fileHash: hash,
    },
  })

  await db.processingJob.create({
    data: {
      pageId: page.id,
      status: 'queued',
    },
  })

  console.log(`[importer] Enqueued: ${filename} → book ${bookId}`)
}
