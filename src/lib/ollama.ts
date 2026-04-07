import { aiResponseSchema, type AiResponse } from './schema'
import { readFile } from 'fs/promises'
import sharp from 'sharp'

// Attempt to recover a JSON object truncated mid-string (model hit token limit)
function repairTruncatedJson(raw: string): unknown | null {
  const suffixes = [
    // Already a complete object, just trailing text — extract it
    '',
    // Truncated inside a string value
    '", "mood": null, "topics": [], "people": [], "places": [], "themes": [], "confidence_score": 0.7, "split_entries": []}',
    // Truncated at a field boundary
    '"mood": null, "topics": [], "people": [], "places": [], "themes": [], "confidence_score": 0.7, "split_entries": []}',
  ]
  for (const suffix of suffixes) {
    const candidate = raw + suffix
    const match = candidate.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
  }
  return null
}

export async function transcribePage(
  imagePath: string,
  promptTemplate: string,
  ollamaUrl: string,
  model: string,
  monthHint?: string | null,
  bookYearHint?: string | null
): Promise<AiResponse> {
  let imageBuffer: Buffer
  let mimeType: string

  const ext = imagePath.toLowerCase().split('.').pop() ?? ''

  if (ext === 'heic') {
    // Convert HEIC to JPEG before sending to Ollama
    imageBuffer = await sharp(imagePath).jpeg({ quality: 90 }).toBuffer()
    mimeType = 'image/jpeg'
  } else if (ext === 'pdf') {
    throw new Error('PDF transcription requires pre-conversion to image. Use a PDF-to-image tool before ingesting.')
  } else if (ext === 'png') {
    imageBuffer = await readFile(imagePath)
    mimeType = 'image/png'
  } else {
    // jpg, jpeg, and any other format — treat as JPEG
    imageBuffer = await readFile(imagePath)
    mimeType = 'image/jpeg'
  }

  const base64Image = imageBuffer.toString('base64')

  let prompt = promptTemplate
  if (monthHint) {
    const year = monthHint.match(/\d{4}/)?.[0] ?? ''
    prompt += `\n\nIMPORTANT: This page is from a folder labelled "${monthHint}". Treat the year ${year} as authoritative when inferring the date. Do not infer a different year unless the page itself explicitly states one.`
  } else if (bookYearHint) {
    prompt += `\n\nIMPORTANT: This page is from a journal covering the year(s) ${bookYearHint}. Use whichever of these years best fits the date context on the page. Do not infer a year outside this range unless the page itself explicitly states one.`
  }

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      format: 'json',
      stream: false,
      options: { num_predict: 16384 },
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Image],
        },
      ],
    }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const body = await response.json()
  const rawContent = body?.message?.content

  if (!rawContent) {
    throw new Error('Ollama returned empty response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    // Try to recover truncated JSON (model hit token limit mid-transcription)
    parsed = repairTruncatedJson(rawContent)
    if (!parsed) {
      throw new Error(`Ollama returned non-JSON: ${rawContent.slice(0, 200)}`)
    }
  }

  const validated = aiResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`AI response schema invalid: ${validated.error.message}`)
  }

  return validated.data
}
