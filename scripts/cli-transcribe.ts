#!/usr/bin/env tsx
/**
 * cli-transcribe.ts
 *
 * Transcribe diary images using the Claude Code CLI (subscription, not API tokens).
 *
 * Usage:
 *   DATABASE_URL=postgresql://journal:journal@localhost:5432/journal \
 *   tsx scripts/cli-transcribe.ts <image-dir> <book-name-or-id> [month-hint]
 *
 * Examples:
 *   DATABASE_URL=... tsx scripts/cli-transcribe.ts \
 *     "/Volumes/MyDrive/Documents/Diary/Book 3/[6] June 19" \
 *     "Bok 3 - 2019" \
 *     "[6] June 19"
 */

import { spawnSync } from 'child_process'
import { readdirSync, readFileSync, copyFileSync, mkdirSync } from 'fs'
import { join, extname, resolve } from 'path'
import { createHash, randomUUID } from 'crypto'

const DATA_DIR = resolve(process.env.DATA_DIR ?? './data')
const IMAGES_DIR = join(DATA_DIR, 'images')

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic'])
const CONFIDENCE_THRESHOLD = 0.85

async function callOllama(model: string, imageBase64: string, promptText: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: promptText, images: [imageBase64] }],
      stream: true,
      think: false,
      options: { temperature: 0.1, repeat_penalty: 1.5, num_predict: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
  if (!res.body) throw new Error('No response body')

  let full = ''
  const decoder = new TextDecoder()
  process.stderr.write('  ')
  let aborted = false
  for await (const chunk of res.body) {
    if (aborted) break
    const lines = decoder.decode(chunk).split('\n').filter(Boolean)
    for (const line of lines) {
      const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
      const token = json.message?.content ?? ''
      full += token
      process.stderr.write(token)
      if (json.done) process.stderr.write('\n')
      // Detect repetition loop: same phrase (8+ chars) repeated 6+ times in the last 400 chars
      if (full.length > 600 && /(.{8,})\1{5,}/.test(full.slice(-400))) {
        process.stderr.write('\n[repetition loop detected, aborting]\n')
        aborted = true
        break
      }
    }
  }
  if (aborted) throw new Error('repetition loop')
  return full
}

async function main() {
  const [, , dir, bookNameOrId, monthHint, ollamaModel] = process.argv
  if (!dir || !bookNameOrId) {
    console.error('Usage: tsx scripts/cli-transcribe.ts <image-dir> <book-name-or-id> [month-hint] [ollama-model]')
    process.exit(1)
  }
  if (ollamaModel) console.log(`[cli] Using Ollama model: ${ollamaModel}`)

  const { db } = await import('../src/lib/db')
  const { aiResponseSchema } = await import('../src/lib/schema')
  const { buildPrompt } = await import('../src/lib/prompt')

  // Find or create book
  let book = await db.book.findFirst({
    where: { OR: [{ id: bookNameOrId }, { name: bookNameOrId }] },
  })
  if (!book) {
    book = await db.book.create({ data: { name: bookNameOrId } })
    console.log(`[cli] Created book: ${book.name} (${book.id})`)
  } else {
    console.log(`[cli] Using book: ${book.name} (${book.id})`)
  }

  // Book year hint from title
  const yearMatches = [...book.name.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0])
  const bookYearHint =
    yearMatches.length === 1
      ? yearMatches[0]
      : yearMatches.length >= 2
        ? `${yearMatches[0]} and ${yearMatches[yearMatches.length - 1]}`
        : null

  // Build prompt
  const metadataRows = await db.entryMetadata.findMany({ select: { themes: true } })
  const existingThemes = [...new Set(metadataRows.flatMap((r) => r.themes))].sort()
  let prompt = buildPrompt('default', existingThemes)

  if (monthHint) {
    const year = monthHint.match(/\d{4}/)?.[0] ?? bookYearHint ?? ''
    prompt += `\n\nIMPORTANT: This page is from a folder labelled "${monthHint}". Treat the year ${year} as authoritative when inferring the date. Do not infer a different year unless the page itself explicitly states one.`
  } else if (bookYearHint) {
    prompt += `\n\nIMPORTANT: This page is from a journal covering the year(s) ${bookYearHint}. Use whichever of these years best fits the date context on the page. Do not infer a year outside this range unless the page itself explicitly states one.`
  }

  // List images
  const files = readdirSync(dir)
    .filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))
    .sort()

  console.log(`[cli] Found ${files.length} images in ${dir}\n`)

  let done = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const imagePath = join(dir, file)
    const prefix = `[${i + 1}/${files.length}] ${file}`

    // Duplicate check
    const fileHash = createHash('sha256').update(readFileSync(imagePath)).digest('hex')
    const existing = await db.page.findUnique({ where: { fileHash } })
    if (existing) {
      console.log(`${prefix} — skipped (already in DB)`)
      skipped++
      continue
    }

    // Copy image into data dir so Docker can serve it
    mkdirSync(IMAGES_DIR, { recursive: true })
    const ext = extname(file).toLowerCase()
    let storedPath: string
    if (ext === '.heic') {
      const sharp = (await import('sharp')).default
      const destName = `${randomUUID()}.jpg`
      storedPath = join(IMAGES_DIR, destName)
      await sharp(imagePath).jpeg({ quality: 90 }).toFile(storedPath)
    } else {
      const destName = `${randomUUID()}${ext}`
      storedPath = join(IMAGES_DIR, destName)
      copyFileSync(imagePath, storedPath)
    }

    // Fetch prior transcription context from the last entry in this book
    const priorEntry = await db.entry.findFirst({
      where: { bookId: book.id },
      orderBy: { createdAt: 'desc' },
      include: { transcription: { select: { rawText: true } } },
    })
    const priorContext = priorEntry?.transcription?.rawText ?? null

    console.log(`${prefix} — transcribing...`)
    const t0 = Date.now()

    const contextNote = priorContext
      ? `\n\nContext from the previous entry in this journal (use this to inform vocabulary, topics, and handwriting recognition on this page):\n"""\n${priorContext.slice(0, 1200)}\n"""`
      : ''

    let raw: string
    if (ollamaModel) {
      const ollamaPrompt = `${prompt}${contextNote}\n\nReturn only valid JSON. No markdown, no explanation.`
      const sharp = (await import('sharp')).default
      const imageBuffer = await sharp(imagePath)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      const imageBase64 = imageBuffer.toString('base64')
      try {
        raw = (await callOllama(ollamaModel, imageBase64, ollamaPrompt)).trim()
      } catch (err) {
        console.error(`${prefix} — Ollama error: ${(err as Error).message}`)
        failed++
        continue
      }
    } else {
      const claudePrompt =
        `Read the image file at "${imagePath}" and transcribe it.\n\n${prompt}${contextNote}\n\nReturn only valid JSON. No markdown, no explanation.`
      const claudeArgs = ['-p', claudePrompt, '--allowedTools', 'Read']
      const spawnOpts = { encoding: 'utf8' as const, timeout: 480_000, maxBuffer: 10 * 1024 * 1024 }

      let result = spawnSync('claude', claudeArgs, spawnOpts)

      if (result.error?.code === 'ETIMEDOUT') {
        console.warn(`${prefix} — timeout, retrying once...`)
        result = spawnSync('claude', claudeArgs, spawnOpts)
      }

      if (result.error) {
        console.error(`${prefix} — CLI error: ${result.error.message}`)
        failed++
        continue
      }

      if (result.status !== 0) {
        const stderr = result.stderr?.trim()
        console.error(`${prefix} — Claude exited with status ${result.status}`)
        if (stderr) console.error(`  stderr: ${stderr.slice(0, 500)}`)
        const stdout = result.stdout?.trim()
        if (stdout) console.error(`  stdout: ${stdout.slice(0, 300)}`)
        failed++
        continue
      }

      raw = result.stdout?.trim() ?? ''
      if (!raw) {
        console.error(`${prefix} — empty response`)
        if (result.stderr) console.error(result.stderr.slice(0, 300))
        failed++
        continue
      }
    }

    // Parse JSON — try direct, then extract from surrounding text, then strip invalid escapes
    const sanitize = (s: string) => s.replace(/\\(?!["\\/bfnrtu0-9])/g, '\\\\')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch {
          try { parsed = JSON.parse(sanitize(match[0])) } catch {}
        }
      }
    }

    if (!parsed) {
      console.error(`${prefix} — could not parse JSON: ${raw.slice(0, 300)}`)
      failed++
      continue
    }

    // Normalize keys that the model commonly misspells (e.g. date_inlamferred → date_inferred)
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      for (const key of Object.keys(obj)) {
        if (key !== 'date_inferred' && /^date_in/.test(key)) {
          obj['date_inferred'] = obj[key]
          delete obj[key]
        }
      }
    }

    const validated = aiResponseSchema.safeParse(parsed)
    if (!validated.success) {
      console.error(`${prefix} — schema invalid: ${validated.error.message}`)
      console.error(`${prefix} — raw parsed: ${JSON.stringify(parsed).slice(0, 400)}`)
      failed++
      continue
    }

    const ai = validated.data
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
      `${prefix} — ${elapsed}s · type: ${ai.entry_type} · confidence: ${ai.confidence_score.toFixed(2)} · date: ${ai.date ?? 'unknown'}`
    )

    const status = ai.confidence_score >= CONFIDENCE_THRESHOLD ? 'approved' : 'pending_review'

    // Continuation: attach to most recent entry in book
    if (ai.is_continuation && !ai.date) {
      const prevEntry = await db.entry.findFirst({
        where: { bookId: book.id },
        orderBy: { createdAt: 'desc' },
      })
      if (prevEntry) {
        const lastPage = await db.page.findFirst({
          where: { entryId: prevEntry.id },
          orderBy: { pageOrder: 'desc' },
        })
        await db.page.create({
          data: {
            bookId: book.id,
            entryId: prevEntry.id,
            filePath: storedPath,
            originalPath: imagePath,
            fileHash,
            pageOrder: (lastPage?.pageOrder ?? 0) + 1,
          },
        })
        if (ai.transcription) {
          const existing = await db.transcription.findUnique({ where: { entryId: prevEntry.id } })
          if (existing) {
            await db.transcription.update({
              where: { entryId: prevEntry.id },
              data: { rawText: existing.rawText + '\n\n' + ai.transcription },
            })
          } else {
            await db.transcription.create({
              data: { entryId: prevEntry.id, rawText: ai.transcription, language: 'no' },
            })
          }
        }
        console.log(`${prefix} — continuation attached to ${prevEntry.id}`)
        done++
        continue
      }
    }

    // Create entry
    const entry = await db.entry.create({
      data: {
        bookId: book.id,
        title: ai.title,
        date: ai.date ? new Date(ai.date) : null,
        dateInferred: ai.date_inferred,
        entryType: ai.entry_type,
        status,
        confidenceScore: ai.confidence_score,
      },
    })

    try {
      await db.page.create({
        data: {
          bookId: book.id,
          entryId: entry.id,
          filePath: storedPath,
          originalPath: imagePath,
          fileHash,
          pageOrder: 0,
        },
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        // Page already saved from a previous interrupted run — clean up orphan entry and skip
        await db.entry.delete({ where: { id: entry.id } })
        console.log(`${prefix} — skipped (page already in DB, orphan entry cleaned up)`)
        done++
        continue
      }
      throw err
    }

    if (ai.entry_type !== 'image' && ai.transcription) {
      await db.transcription.create({
        data: { entryId: entry.id, rawText: ai.transcription, language: 'no' },
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

    // Split entries
    for (let j = 0; j < ai.split_entries.length; j++) {
      const split = ai.split_entries[j]
      const splitEntry = await db.entry.create({
        data: {
          bookId: book.id,
          title: split.title,
          date: split.date ? new Date(split.date) : null,
          dateInferred: split.date_inferred,
          entryType: ai.entry_type,
          status,
          confidenceScore: ai.confidence_score,
        },
      })
      await db.page.create({
        data: {
          bookId: book.id,
          entryId: splitEntry.id,
          filePath: storedPath,
          originalPath: imagePath,
          fileHash: createHash('sha256').update(`${fileHash}:split:${j + 1}`).digest('hex'),
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
      console.log(`${prefix} — split entry ${j + 1}/${ai.split_entries.length} created`)
    }

    done++
  }

  console.log(`\n[cli] Done. Transcribed: ${done} · Skipped: ${skipped} · Failed: ${failed}`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
