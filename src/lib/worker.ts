import type { AiResponse } from './schema'
import type { EntryStatus } from '@/generated/prisma/enums'

export function routeByEntryType(ai: AiResponse): {
  transcription: string | null
  skipTranscription: boolean
} {
  if (ai.entry_type === 'image') {
    return { transcription: null, skipTranscription: true }
  }
  return {
    transcription: ai.transcription,
    skipTranscription: false,
  }
}

export function applyConfidenceDecision(
  score: number,
  threshold: number
): EntryStatus {
  return score >= threshold ? 'approved' : 'pending_review'
}

export async function processJob(
  pageId: string,
  options: {
    ollamaUrl: string
    model: string
    promptTemplate: string
    confidenceThreshold: number
    monthHint?: string | null
  }
): Promise<void> {
  const { db } = await import('./db')
  const { transcribePage } = await import('./ollama')
  const { buildPrompt } = await import('./prompt')
  const { optimiseForWeb, moveToProcessed } = await import('./image')
  const { basename } = await import('path')
  const { unlink } = await import('fs/promises')

  const DATA_DIR = process.env.DATA_DIR ?? './data'

  // Mark as processing
  await db.processingJob.update({
    where: { pageId },
    data: { status: 'processing', startedAt: new Date() },
  })

  const page = await db.page.findUniqueOrThrow({ where: { id: pageId } })

  const prompt = buildPrompt(options.promptTemplate)
  const ai = await transcribePage(
    page.filePath,
    prompt,
    options.ollamaUrl,
    options.model,
    options.monthHint
  )

  const { transcription, skipTranscription } = routeByEntryType(ai)
  const status = applyConfidenceDecision(ai.confidence_score, options.confidenceThreshold)

  // Optimise image
  const outRelPath = `${page.id}.jpg`
  const optimisedPath = await optimiseForWeb(page.filePath, outRelPath)
  const processedPath = await moveToProcessed(
    page.filePath,
    basename(page.filePath)
  )

  // Remove original from inbox (best effort)
  try {
    await unlink(page.filePath)
  } catch {
    // ignore — file may have already been moved
  }

  // Create entry
  const entry = await db.entry.create({
    data: {
      bookId: page.bookId,
      title: ai.title,
      date: ai.date ? new Date(ai.date) : null,
      dateInferred: ai.date_inferred,
      entryType: ai.entry_type,
      status,
      confidenceScore: ai.confidence_score,
    },
  })

  // Link page to entry, update paths
  await db.page.update({
    where: { id: pageId },
    data: {
      entryId: entry.id,
      filePath: optimisedPath,
      originalPath: processedPath,
    },
  })

  if (!skipTranscription && transcription) {
    await db.transcription.create({
      data: {
        entryId: entry.id,
        rawText: transcription,
        language: 'no',
      },
    })
  }

  await db.entryMetadata.create({
    data: {
      entryId: entry.id,
      mood: ai.mood,
      topics: ai.topics,
      people: ai.people,
      places: ai.places,
      themes: ai.themes,
    },
  })

  await db.processingJob.update({
    where: { pageId },
    data: { status: 'done', completedAt: new Date() },
  })
}

export async function runWorkerLoop(intervalMs = 2000): Promise<void> {
  const { db } = await import('./db')

  const getSettings = async () => {
    const rows = await db.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      ollamaUrl: map['ollama_url'] ?? 'http://localhost:11434',
      model: map['ollama_model'] ?? 'qwen2.5vl:7b',
      promptTemplate: map['prompt_template'] ?? 'default',
      confidenceThreshold: parseFloat(map['confidence_threshold'] ?? '0.85'),
    }
  }

  const processNext = async () => {
    const job = await db.processingJob.findFirst({
      where: {
        status: 'queued',
        attempts: { lt: 3 },
      },
      orderBy: { page: { ingestedAt: 'asc' } },
    })

    if (!job) return

    const settings = await getSettings()

    // Re-parse month hint from the page's file path context
    const page = await db.page.findUnique({ where: { id: job.pageId } })
    let monthHint: string | null = null
    if (page) {
      // Use a variable to prevent vite from statically resolving this import
      // before importer.ts exists (importer.ts is created in Task 8)
      const importerPath = './importer'
      const DATA_DIR = process.env.DATA_DIR ?? './data'
      const inboxDir = `${DATA_DIR}/inbox`
      const { relative } = await import('path')
      // Best effort: try to parse from original path
      try {
        const { parseInboxPath, detectMonthHint } = await import(/* @vite-ignore */ importerPath)
        const rel = relative(inboxDir, page.originalPath)
        const { monthHint: mh } = parseInboxPath(rel, inboxDir)
        if (mh) monthHint = detectMonthHint(mh)
      } catch {
        // Path may already be in processed/ — no hint available
      }
    }

    try {
      await processJob(job.pageId, { ...settings, monthHint })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const newAttempts = job.attempts + 1
      await db.processingJob.update({
        where: { pageId: job.pageId },
        data: {
          status: newAttempts >= 3 ? 'failed' : 'queued',
          attempts: newAttempts,
          error: message,
          startedAt: null,
        },
      })
    }
  }

  setInterval(processNext, intervalMs)
}
