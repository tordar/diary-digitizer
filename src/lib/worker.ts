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
    aiProvider: string
    ollamaUrl: string
    model: string
    anthropicApiKey: string
    anthropicModel: string
    promptTemplate: string
    confidenceThreshold: number
    monthHint?: string | null
    bookYearHint?: string | null
  }
): Promise<void> {
  const { db } = await import('./db')
  const { transcribePage } = await import('./ollama')
  const { transcribePageWithAnthropic } = await import('./anthropic')
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

  const metadataRows = await db.entryMetadata.findMany({ select: { themes: true } })
  const existingThemes = [...new Set(metadataRows.flatMap((r) => r.themes))].sort()
  const prompt = buildPrompt(options.promptTemplate, existingThemes)
  console.log(`[worker] → Sending to model: ${basename(page.filePath)} (provider: ${options.aiProvider})`)
  const t0 = Date.now()
  let ai
  if (options.aiProvider === 'anthropic') {
    ai = await transcribePageWithAnthropic(
      page.filePath,
      prompt,
      options.anthropicApiKey,
      options.anthropicModel,
      options.monthHint,
      options.bookYearHint
    )
  } else {
    ai = await transcribePage(
      page.filePath,
      prompt,
      options.ollamaUrl,
      options.model,
      options.monthHint,
      options.bookYearHint
    )
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[worker] ← Model done in ${elapsed}s — type: ${ai.entry_type}, confidence: ${ai.confidence_score.toFixed(2)}, date: ${ai.date ?? 'unknown'}`)

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

  // --- Continuation page: attach to the most recent entry in the same book ---
  // A page with its own date is never a continuation, regardless of what the model says.
  if (ai.is_continuation && !ai.date) {
    const prevEntry = await db.entry.findFirst({
      where: { bookId: page.bookId },
      orderBy: { createdAt: 'desc' },
    })

    if (prevEntry) {
      const lastPage = await db.page.findFirst({
        where: { entryId: prevEntry.id },
        orderBy: { pageOrder: 'desc' },
      })
      const nextOrder = (lastPage?.pageOrder ?? 0) + 1

      await db.page.update({
        where: { id: pageId },
        data: { entryId: prevEntry.id, filePath: optimisedPath, originalPath: processedPath, pageOrder: nextOrder },
      })

      // Append transcription
      if (!skipTranscription && transcription) {
        const existing = await db.transcription.findUnique({ where: { entryId: prevEntry.id } })
        if (existing) {
          await db.transcription.update({
            where: { entryId: prevEntry.id },
            data: { rawText: existing.rawText + '\n\n' + transcription },
          })
        } else {
          await db.transcription.create({ data: { entryId: prevEntry.id, rawText: transcription, language: 'no' } })
        }
      }

      console.log(`[worker] Continuation page attached to entry ${prevEntry.id}`)
      await db.processingJob.update({ where: { pageId }, data: { status: 'done', completedAt: new Date() } })
      return
    }
    // No previous entry found — fall through and create a new one
  }

  // --- Normal flow: create entry ---
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

  // --- Split entries: additional dated entries on the same page ---
  if (ai.split_entries.length > 0) {
    const { createHash } = await import('crypto')
    for (let i = 0; i < ai.split_entries.length; i++) {
      const split = ai.split_entries[i]
      const splitStatus = applyConfidenceDecision(ai.confidence_score, options.confidenceThreshold)

      const splitEntry = await db.entry.create({
        data: {
          bookId: page.bookId,
          title: split.title,
          date: split.date ? new Date(split.date) : null,
          dateInferred: split.date_inferred,
          entryType: ai.entry_type,
          status: splitStatus,
          confidenceScore: ai.confidence_score,
        },
      })

      // Virtual page: same image, synthetic hash so it doesn't collide
      const virtualHash = createHash('sha256').update(`${page.fileHash}:split:${i + 1}`).digest('hex')
      await db.page.create({
        data: {
          bookId: page.bookId,
          entryId: splitEntry.id,
          filePath: optimisedPath,
          originalPath: processedPath,
          fileHash: virtualHash,
          pageOrder: 0,
        },
      })

      if (split.transcription) {
        await db.transcription.create({
          data: { entryId: splitEntry.id, rawText: split.transcription, language: 'no' },
        })
      }

      await db.entryMetadata.create({
        data: {
          entryId: splitEntry.id,
          mood: split.mood,
          topics: ai.topics,
          people: ai.people,
          places: ai.places,
          themes: ai.themes,
        },
      })

      console.log(`[worker] Split entry ${i + 1}/${ai.split_entries.length} created: ${splitEntry.id}`)
    }
  }

  await db.processingJob.update({
    where: { pageId },
    data: { status: 'done', completedAt: new Date() },
  })
}

export async function runWorkerLoop(intervalMs = 2000): Promise<void> {
  const { db } = await import('./db')

  // Recover jobs stuck in 'processing' from a previous crashed run
  const stuck = await db.processingJob.updateMany({
    where: { status: 'processing' },
    data: { status: 'queued', startedAt: null },
  })
  if (stuck.count > 0) console.log(`[worker] Recovered ${stuck.count} stuck jobs`)


  const getSettings = async () => {
    const rows = await db.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      aiProvider: map['ai_provider'] ?? 'ollama',
      ollamaUrl: map['ollama_url'] ?? 'http://localhost:11434',
      model: map['ollama_model'] ?? 'qwen2.5vl:7b',
      anthropicApiKey: map['anthropic_api_key'] ?? '',
      anthropicModel: map['anthropic_model'] ?? 'claude-opus-4-6',
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
    // awaiting_book jobs are intentionally skipped — they need user assignment first

    if (!job) return

    const settings = await getSettings()

    // Re-parse month hint from the page's file path context
    const page = await db.page.findUnique({ where: { id: job.pageId }, include: { book: { select: { name: true } } } })
    const label = page?.filePath.split('/').pop() ?? job.pageId
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
        const { bookFolderHint, monthHint: mh } = parseInboxPath(rel, inboxDir)
        const hintSource = mh ?? bookFolderHint
        if (hintSource) monthHint = detectMonthHint(hintSource)
      } catch {
        // Path may already be in processed/ — no hint available
      }
    }

    // Fallback: extract year(s) from book title (e.g. "Dagbok 1994" → "1994", "1993-1994" → "1993 and 1994")
    let bookYearHint: string | null = null
    if (page?.book?.name) {
      const matches = [...page.book.name.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0])
      if (matches.length === 1) bookYearHint = matches[0]
      else if (matches.length >= 2) bookYearHint = `${matches[0]} and ${matches[matches.length - 1]}`
    }

    console.log(`[worker] Processing: ${label}`)
    try {
      await processJob(job.pageId, { ...settings, monthHint, bookYearHint })
      console.log(`[worker] Done: ${label}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const newAttempts = job.attempts + 1
      console.error(`[worker] Failed (attempt ${newAttempts}): ${label} — ${message}`)
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

  // Run one job at a time — wait for it to finish before scheduling the next
  const schedule = () => {
    processNext().finally(() => setTimeout(schedule, intervalMs))
  }
  schedule()
}
