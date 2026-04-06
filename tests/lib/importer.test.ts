import { describe, it, expect } from 'vitest'
import { parseInboxPath, detectMonthHint } from '@/lib/importer'

describe('parseInboxPath', () => {
  it('parses structured path: book/month/file', () => {
    const result = parseInboxPath('Book 4/[11] November 19/001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(false)
    expect(result.monthHint).toBe('[11] November 19')
  })

  it('detects Special subfolder', () => {
    const result = parseInboxPath('Book 4/Special/611.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(true)
    expect(result.monthHint).toBeNull()
  })

  it('handles flat file with no subfolders', () => {
    const result = parseInboxPath('001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBeNull()
    expect(result.isSpecial).toBe(false)
  })

  it('handles book-level file with no month', () => {
    const result = parseInboxPath('Book 4/001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(false)
    expect(result.monthHint).toBeNull()
  })
})

describe('detectMonthHint', () => {
  it('parses [11] November 19 as November 2019', () => {
    expect(detectMonthHint('[11] November 19')).toBe('November 2019')
  })

  it('parses January 20 as January 2020', () => {
    expect(detectMonthHint('[1] January 20')).toBe('January 2020')
  })

  it('returns null for unrecognised format', () => {
    expect(detectMonthHint('Special')).toBeNull()
    expect(detectMonthHint('random folder')).toBeNull()
  })
})
