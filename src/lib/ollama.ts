import { aiResponseSchema, type AiResponse } from './schema'
import { readFile } from 'fs/promises'

export async function transcribePage(
  imagePath: string,
  promptTemplate: string,
  ollamaUrl: string,
  model: string,
  monthHint?: string | null
): Promise<AiResponse> {
  const imageBuffer = await readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const ext = imagePath.toLowerCase().split('.').pop()
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

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
