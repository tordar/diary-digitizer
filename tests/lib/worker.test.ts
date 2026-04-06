import { describe, it, expect } from 'vitest'
import { routeByEntryType, applyConfidenceDecision } from '@/lib/worker'
import type { AiResponse } from '@/lib/schema'

describe('routeByEntryType', () => {
  it('returns transcription for text entries', () => {
    const ai: AiResponse = {
      entry_type: 'text',
      title: 'Test',
      date: '2021-01-01',
      date_inferred: false,
      transcription: 'Some text',
      mood: 'glad',
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.9,
    }
    const result = routeByEntryType(ai)
    expect(result.transcription).toBe('Some text')
    expect(result.skipTranscription).toBe(false)
  })

  it('sets skipTranscription for image entries', () => {
    const ai: AiResponse = {
      entry_type: 'image',
      title: null,
      date: null,
      date_inferred: false,
      transcription: null,
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.8,
    }
    const result = routeByEntryType(ai)
    expect(result.skipTranscription).toBe(true)
  })
})

describe('applyConfidenceDecision', () => {
  it('returns approved for score >= threshold', () => {
    expect(applyConfidenceDecision(0.9, 0.85)).toBe('approved')
    expect(applyConfidenceDecision(0.85, 0.85)).toBe('approved')
  })

  it('returns pending_review for score below threshold', () => {
    expect(applyConfidenceDecision(0.84, 0.85)).toBe('pending_review')
    expect(applyConfidenceDecision(0.0, 0.85)).toBe('pending_review')
  })
})
