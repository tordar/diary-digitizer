import { z } from 'zod'

const MONTH_NAMES: Record<string, string> = {
  januar: '01', february: '02', februar: '02', mars: '03', april: '04',
  mai: '05', may: '05', juni: '06', june: '06', juli: '07', july: '07',
  august: '08', september: '09', oktober: '10', october: '10',
  november: '11', desember: '12', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function normaliseDate(v: string): string | null {
  // Already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  // YYYY-MM (partial — use day 01)
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`
  // DD.MM.YYYY
  const numericFull = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
  if (numericFull) {
    const [, day, month, year] = numericFull
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // DD.MM.YY (2-digit year → 2000+)
  const numericShort = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})$/)
  if (numericShort) {
    const [, day, month, yr2] = numericShort
    return `${2000 + parseInt(yr2, 10)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // D. Month YYYY or DD. Month YYYY (Norwegian/English)
  const longMatch = v.match(/^(\d{1,2})[.\s]+([A-Za-zæøåÆØÅ]+)[.\s,]+(\d{4})$/)
  if (longMatch) {
    const [, day, monthRaw, year] = longMatch
    const month = MONTH_NAMES[monthRaw.toLowerCase()]
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`
  }
  // D. Month YY or DD. Month YY (2-digit year → 2000+)
  const shortYearMatch = v.match(/^(\d{1,2})[.\s]+([A-Za-zæøåÆØÅ]+)[.\s,]+(\d{2})$/)
  if (shortYearMatch) {
    const [, day, monthRaw, yr2] = shortYearMatch
    const month = MONTH_NAMES[monthRaw.toLowerCase()]
    if (month) return `${2000 + parseInt(yr2, 10)}-${month}-${day.padStart(2, '0')}`
  }
  // Month YYYY (no day)
  const monthYearMatch = v.match(/^([A-Za-zæøåÆØÅ]+)[.\s,]+(\d{4})$/)
  if (monthYearMatch) {
    const [, monthRaw, year] = monthYearMatch
    const month = MONTH_NAMES[monthRaw.toLowerCase()]
    if (month) return `${year}-${month}-01`
  }
  return null
}

const dateField = z.string().nullable().transform((v) => {
  if (v === null) return null
  return normaliseDate(v.trim())
})

const moodField = z.array(z.string()).default([])

const splitEntrySchema = z.object({
  date: dateField,
  date_inferred: z.boolean(),
  title: z.string().nullable(),
  transcription: z.string().nullable(),
  mood: moodField,
})

export type SplitEntry = z.infer<typeof splitEntrySchema>

export const aiResponseSchema = z.object({
  entry_type: z.enum(['text', 'image', 'mixed', 'special']),
  is_continuation: z.boolean().optional().default(false),
  title: z.string().nullable(),
  date: dateField,
  date_inferred: z.boolean(),
  transcription: z.string().nullable(),
  mood: moodField,
  topics: z.array(z.string()),
  people: z.array(z.string()),
  places: z.array(z.string()),
  themes: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
  split_entries: z.array(splitEntrySchema).optional().default([]),
})

export type AiResponse = z.infer<typeof aiResponseSchema>
