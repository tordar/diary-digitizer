import { describe, it, expect } from 'vitest'
import { buildPrompt, DEFAULT_PROMPT_TEMPLATE } from '@/lib/prompt'

describe('buildPrompt', () => {
  it('returns the template unchanged when using default', () => {
    const result = buildPrompt('default')
    expect(result).toBe(DEFAULT_PROMPT_TEMPLATE)
  })

  it('returns custom template as-is', () => {
    const custom = 'My custom prompt'
    expect(buildPrompt(custom)).toBe(custom)
  })

  it('default prompt requests JSON output', () => {
    expect(DEFAULT_PROMPT_TEMPLATE).toContain('JSON')
  })

  it('default prompt mentions all required fields', () => {
    const fields = ['entry_type', 'title', 'date', 'transcription', 'mood', 'topics', 'people', 'places', 'themes', 'confidence_score']
    for (const field of fields) {
      expect(DEFAULT_PROMPT_TEMPLATE).toContain(field)
    }
  })
})
