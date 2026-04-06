import { describe, it, expect } from 'vitest'
import { buildEntriesWhere } from '@/app/api/entries/route'

describe('buildEntriesWhere', () => {
  it('returns empty where for no params', () => {
    const where = buildEntriesWhere({})
    expect(where).toEqual({ status: 'approved' })
  })

  it('adds book filter', () => {
    const where = buildEntriesWhere({ bookId: 'abc' })
    expect(where).toMatchObject({ bookId: 'abc' })
  })

  it('adds mood filter', () => {
    const where = buildEntriesWhere({ mood: 'glad' })
    expect(where).toMatchObject({ metadata: { mood: 'glad' } })
  })

  it('adds entry type filter', () => {
    const where = buildEntriesWhere({ entryType: 'image' })
    expect(where).toMatchObject({ entryType: 'image' })
  })

  it('adds people filter using array contains', () => {
    const where = buildEntriesWhere({ person: 'Jonas' })
    expect(where).toMatchObject({
      metadata: { people: { has: 'Jonas' } },
    })
  })

  it('adds date range filter', () => {
    const where = buildEntriesWhere({ dateFrom: '2020-01-01', dateTo: '2021-01-01' })
    expect(where).toMatchObject({
      date: { gte: new Date('2020-01-01'), lte: new Date('2021-01-01') },
    })
  })
})
