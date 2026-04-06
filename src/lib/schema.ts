import { z } from 'zod'

export const aiResponseSchema = z.object({
  entry_type: z.enum(['text', 'image', 'mixed', 'special']),
  title: z.string().nullable(),
  date: z.string().nullable().refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    { message: 'date must be YYYY-MM-DD or null' }
  ),
  date_inferred: z.boolean(),
  transcription: z.string().nullable(),
  mood: z.enum(['glad', 'nøytral', 'lav', 'blandet']).nullable(),
  topics: z.array(z.string()),
  people: z.array(z.string()),
  places: z.array(z.string()),
  themes: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
})

export type AiResponse = z.infer<typeof aiResponseSchema>
