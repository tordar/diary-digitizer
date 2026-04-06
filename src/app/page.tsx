'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FilterSidebar } from '@/components/FilterSidebar'
import { EntryCard } from '@/components/EntryCard'
import { TimelineHeatmap } from '@/components/TimelineHeatmap'
import { ProcessingStatus } from '@/components/ProcessingStatus'

interface Entry {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  book: { name: string }
  pages: { filePath: string }[]
  transcription: { correctedText: string | null; rawText: string } | null
  metadata: { mood: string | null; topics: string[]; people: string[]; places: string[] } | null
}

const MOOD_OPTIONS = [
  { value: 'glad', label: '😄 Glad', count: 0 },
  { value: 'nøytral', label: '🙂 Nøytral', count: 0 },
  { value: 'lav', label: '😔 Lav', count: 0 },
  { value: 'blandet', label: '😤 Blandet', count: 0 },
]

const TYPE_OPTIONS = [
  { value: 'text', label: '📝 Tekst', count: 0 },
  { value: 'image', label: '🖼 Bilde', count: 0 },
  { value: 'mixed', label: '✏️ Blandet', count: 0 },
  { value: 'special', label: '📋 Spesiell', count: 0 },
]

function BrowsePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeFilters = {
    bookId: searchParams.get('bookId') ?? undefined,
    mood: searchParams.get('mood') ?? undefined,
    entryType: searchParams.get('entryType') ?? undefined,
    topic: searchParams.get('topic') ?? undefined,
    person: searchParams.get('person') ?? undefined,
    place: searchParams.get('place') ?? undefined,
  }

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [books, setBooks] = useState<{ value: string; label: string; count: number }[]>([])
  const [exploreData, setExploreData] = useState<{
    topTopics: { topic: string; count: number }[]
    topPeople: { person: string; count: number }[]
    topPlaces: { place: string; count: number }[]
    moodByYear: { year: number; count: number }[]
  } | null>(null)

  const buildParams = useCallback(
    (overrides: Record<string, string | null> = {}) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k)
        else params.set(k, v)
      }
      return params
    },
    [searchParams]
  )

  const onFilterChange = (key: string, value: string | null) => {
    router.push(`/?${buildParams({ [key]: value })}`)
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    fetch(`/api/entries?${params}`)
      .then((r) => r.json())
      .then(({ entries: e, total: t }) => {
        setEntries(e)
        setTotal(t)
      })
  }, [searchParams, q])

  // Derive mood and type counts from current entry list
  const moodCounts = entries.reduce<Record<string, number>>((acc, e) => {
    const m = e.metadata?.mood
    if (m) acc[m] = (acc[m] ?? 0) + 1
    return acc
  }, {})

  const typeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.entryType] = (acc[e.entryType] ?? 0) + 1
    return acc
  }, {})

  useEffect(() => {
    fetch('/api/books')
      .then((r) => r.json())
      .then((b) =>
        setBooks(b.map((book: { id: string; name: string; _count: { entries: number } }) => ({
          value: book.id,
          label: book.name,
          count: book._count.entries,
        })))
      )
    fetch('/api/explore')
      .then((r) => r.json())
      .then(setExploreData)
  }, [])

  const yearCounts: { year: number; count: number }[] = exploreData
    ? Object.entries(
        exploreData.moodByYear.reduce<Record<number, number>>((acc, d) => {
          acc[d.year] = (acc[d.year] ?? 0) + (d as unknown as { count: number }).count
          return acc
        }, {})
      )
        .map(([year, count]) => ({ year: Number(year), count }))
        .sort((a, b) => b.year - a.year)
    : []

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      <ProcessingStatus />
      <div className="flex min-h-0 flex-1">
        <FilterSidebar
          books={books}
          moods={MOOD_OPTIONS.map((o) => ({ ...o, count: moodCounts[o.value] ?? 0 }))}
          entryTypes={TYPE_OPTIONS.map((o) => ({ ...o, count: typeCounts[o.value] ?? 0 }))}
          topics={(exploreData?.topTopics ?? []).map((t) => ({ value: t.topic, label: t.topic, count: t.count }))}
          people={(exploreData?.topPeople ?? []).map((p) => ({ value: p.person, label: p.person, count: p.count }))}
          places={(exploreData?.topPlaces ?? []).map((p) => ({ value: p.place, label: p.place, count: p.count }))}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-800 p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk i alle oppføringer..."
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(activeFilters).map(([key, val]) =>
                val ? (
                  <button
                    key={key}
                    onClick={() => onFilterChange(key, null)}
                    className="rounded-full bg-violet-800 px-2.5 py-0.5 text-[11px] text-violet-200"
                  >
                    {val} ×
                  </button>
                ) : null
              )}
              <span className="ml-1 self-center text-[11px] text-slate-600">{total} oppføringer</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  id={entry.id}
                  title={entry.title}
                  date={entry.date}
                  dateInferred={entry.dateInferred}
                  entryType={entry.entryType}
                  book={entry.book}
                  mood={entry.metadata?.mood ?? null}
                  topics={entry.metadata?.topics ?? []}
                  people={entry.metadata?.people ?? []}
                  snippet={entry.transcription?.correctedText ?? entry.transcription?.rawText ?? null}
                  pageCount={entry.pages.length}
                  thumbnailPath={entry.pages[0]?.filePath ?? null}
                />
              ))}
              {entries.length === 0 && (
                <p className="py-16 text-center text-sm text-slate-600">Ingen oppføringer funnet</p>
              )}
            </div>
          </div>
        </div>

        <TimelineHeatmap
          data={yearCounts}
          totalEntries={total}
          totalPeople={exploreData?.topPeople.length ?? 0}
          totalPlaces={exploreData?.topPlaces.length ?? 0}
        />
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Laster...</div>}>
      <BrowsePageContent />
    </Suspense>
  )
}
