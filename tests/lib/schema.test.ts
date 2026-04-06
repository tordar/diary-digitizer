import { describe, it, expect } from 'vitest'
import { aiResponseSchema, type AiResponse } from '@/lib/schema'

describe('aiResponseSchema', () => {
  it('validates a complete valid response', () => {
    const input: AiResponse = {
      entry_type: 'text',
      title: 'En god dag',
      date: '2021-03-15',
      date_inferred: false,
      transcription: 'Dette er teksten.',
      mood: 'glad',
      topics: ['arbeid'],
      people: ['Jonas'],
      places: ['Oslo'],
      themes: ['produktivitet'],
      confidence_score: 0.95,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('allows null date and title for special entries', () => {
    const input = {
      entry_type: 'special',
      title: null,
      date: null,
      date_inferred: false,
      transcription: 'Uke 46',
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.9,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid entry_type', () => {
    const input = { entry_type: 'unknown', confidence_score: 0.5 }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects confidence_score outside 0–1', () => {
    const input = {
      entry_type: 'text',
      title: null,
      date: null,
      date_inferred: false,
      transcription: '',
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 1.5,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
