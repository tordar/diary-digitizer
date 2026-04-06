import { aiResponseSchema, type AiResponse } from './schema'
import { readFile } from 'fs/promises'
import sharp from 'sharp'

export async function transcribePage(
  imagePath: string,
  promptTemplate: string,
  ollamaUrl: string,
  model: string,
  monthHint?: string | null
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

  const prompt = monthHint
    ? `${promptTemplate}\n\nNote: This page is from ${monthHint}. Use this as context for date inference.`
    : promptTemplate

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      format: 'json',
      stream: false,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [`data:${mimeType};base64,${base64Image}`],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
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
    throw new Error(`Ollama returned non-JSON: ${rawContent.slice(0, 200)}`)
  }

  const validated = aiResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`AI response schema invalid: ${validated.error.message}`)
  }

  return validated.data
}
