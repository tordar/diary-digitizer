import Anthropic from '@anthropic-ai/sdk'
import { aiResponseSchema, type AiResponse } from './schema'
import { readFile } from 'fs/promises'
import sharp from 'sharp'

export const SYSTEM_PROMPT = `You are an expert at transcribing handwritten Norwegian journals with high accuracy. You have deep knowledge of Norwegian language, grammar, and common expressions. You return only valid JSON with no markdown or explanation.`

export async function transcribePageWithAnthropic(
  imagePath: string,
  promptTemplate: string,
  apiKey: string,
  model: string,
  monthHint?: string | null,
  bookYearHint?: string | null
): Promise<AiResponse> {
  const ext = imagePath.toLowerCase().split('.').pop() ?? ''

  let imageBuffer: Buffer
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  if (ext === 'heic') {
    imageBuffer = await sharp(imagePath).jpeg({ quality: 90 }).toBuffer()
    mediaType = 'image/jpeg'
  } else if (ext === 'png') {
    imageBuffer = await readFile(imagePath)
    mediaType = 'image/png'
  } else {
    imageBuffer = await readFile(imagePath)
    mediaType = 'image/jpeg'
  }

  let prompt = promptTemplate
  if (monthHint) {
    const year = monthHint.match(/\d{4}/)?.[0] ?? ''
    prompt += `\n\nIMPORTANT: This page is from a folder labelled "${monthHint}". Treat the year ${year} as authoritative when inferring the date. Do not infer a different year unless the page itself explicitly states one.`
  } else if (bookYearHint) {
    prompt += `\n\nIMPORTANT: This page is from a journal covering the year(s) ${bookYearHint}. Use whichever of these years best fits the date context on the page. Do not infer a year outside this range unless the page itself explicitly states one.`
  }

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })

  const rawContent = message.content[0]?.type === 'text' ? message.content[0].text : null
  if (!rawContent) throw new Error('Anthropic returned empty response')

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    // Strip markdown code fences if present
    const stripped = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    try {
      parsed = JSON.parse(stripped)
    } catch {
      throw new Error(`Anthropic returned non-JSON: ${rawContent.slice(0, 200)}`)
    }
  }

  const validated = aiResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`AI response schema invalid: ${validated.error.message}`)
  }

  return validated.data
}
