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
  metadata: { mood: string[]; topics: string[]; people: string[]; places: string[] } | null
  _count: { pages: number }
}

const MOOD_OPTIONS = [
  { value: 'glad', label: '😄 Glad' },
  { value: 'lettet', label: '😮‍💨 Lettet' },
  { value: 'takknemlig', label: '🙏 Takknemlig' },
  { value: 'spent', label: '😬 Spent' },
  { value: 'optimistisk', label: '🌟 Optimistisk' },
  { value: 'stolt', label: '💪 Stolt' },
  { value: 'energisk', label: '⚡ Energisk' },
  { value: 'inspirert', label: '✨ Inspirert' },
  { value: 'rolig', label: '😌 Rolig' },
  { value: 'nostalgisk', label: '🕰️ Nostalgisk' },
  { value: 'trist', label: '😢 Trist' },
  { value: 'ensom', label: '🌑 Ensom' },
  { value: 'frustrert', label: '😤 Frustrert' },
  { value: 'sint', label: '😠 Sint' },
  { value: 'engstelig', label: '😰 Engstelig' },
  { value: 'utmattet', label: '😴 Utmattet' },
  { value: 'overveldet', label: '🌊 Overveldet' },
  { value: 'nedfor', label: '😞 Nedfor' },
  { value: 'skuffet', label: '😕 Skuffet' },
  { value: 'urolig', label: '😟 Urolig' },
  { value: 'selvkritisk', label: '🪞 Selvkritisk' },
  { value: 'reflektert', label: '🤔 Reflektert' },
  { value: 'ambivalent', label: '⚖️ Ambivalent' },
  { value: 'søkende', label: '🔍 Søkende' },
  { value: 'usikker', label: '❓ Usikker' },
  { value: 'melankolsk', label: '🌧️ Melankolsk' },
  { value: 'sårbar', label: '🫀 Sårbar' },
  { value: 'lengtende', label: '🌅 Lengtende' },
  { value: 'bekymret', label: '😟 Bekymret' },
  { value: 'håpefull', label: '🌱 Håpefull' },
  { value: 'nøytral', label: '😐 Nøytral' },
  { value: 'observerende', label: '👁️ Observerende' },
].map((m) => ({ ...m, count: 0 }))

const TYPE_OPTIONS = [
  { value: 'text', label: '📝 Tekst', count: 0 },
  { value: 'image', label: '🖼 Bilde', count: 0 },
  { value: 'mixed', label: '✏️ Blandet', count: 0 },
  { value: 'special', label: '📋 Spesiell', count: 0 },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

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

  const activeYear = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
  const activeMonth = searchParams.get('month') ? Number(searchParams.get('month')) : undefined

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [books, setBooks] = useState<{ value: string; label: string; count: number }[]>([])
  const [exploreData, setExploreData] = useState<{
    topTopics: { topic: string; count: number }[]
    topPeople: { person: string; count: number }[]
    topPlaces: { place: string; count: number }[]
    moodByYear: { year: number; mood: string; count: number }[]
    entriesByYear: { year: number; count: number }[]
    entriesByYearMonth: { year: number; month: number; count: number }[]
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

  const onYearClick = (year: number) => {
    if (activeYear === year) {
      router.push(`/?${buildParams({ year: null, month: null })}`)
    } else {
      router.push(`/?${buildParams({ year: String(year), month: null })}`)
    }
  }

  const onMonthClick = (month: number) => {
    if (activeMonth === month) {
      router.push(`/?${buildParams({ month: null })}`)
    } else {
      router.push(`/?${buildParams({ month: String(month) })}`)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const mergeSelected = async () => {
    if (selected.size < 2 || merging) return
    setMerging(true)
    try {
      const res = await fetch('/api/entries/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      const { id } = await res.json()
      exitSelectMode()
      router.push(`/entries/${id}`)
    } finally {
      setMerging(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')

    // Convert year/month to dateFrom/dateTo
    params.delete('year')
    params.delete('month')
    if (activeYear) {
      if (activeMonth) {
        const lastDay = new Date(activeYear, activeMonth, 0).getDate()
        params.set('dateFrom', `${activeYear}-${String(activeMonth).padStart(2, '0')}-01`)
        params.set('dateTo', `${activeYear}-${String(activeMonth).padStart(2, '0')}-${lastDay}`)
      } else {
        params.set('dateFrom', `${activeYear}-01-01`)
        params.set('dateTo', `${activeYear}-12-31`)
      }
    }

    fetch(`/api/entries?${params}`)
      .then((r) => r.json())
      .then(({ entries: e, total: t }) => {
        setEntries(e)
        setTotal(t)
      })
  }, [searchParams, q])

  // Derive mood and type counts from current entry list
  const moodCounts = entries.reduce<Record<string, number>>((acc, e) => {
    for (const m of e.metadata?.mood ?? []) {
      acc[m] = (acc[m] ?? 0) + 1
    }
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

  const yearCounts = exploreData?.entriesByYear ?? []

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

            {/* Year navigation */}
            {yearCounts.length > 0 && (
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
                {[...yearCounts].sort((a, b) => a.year - b.year).map(({ year, count }) => (
                  <button
                    key={year}
                    onClick={() => onYearClick(year)}
                    className={`flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
                      activeYear === year
                        ? 'bg-violet-700 text-violet-100'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {year}
                    <span className={`ml-1 text-[10px] ${activeYear === year ? 'text-violet-300' : 'text-slate-600'}`}>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Month navigation */}
            {activeYear && (
              <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
                {MONTH_NAMES.map((name, i) => {
                  const m = i + 1
                  const count = exploreData?.entriesByYearMonth.find(
                    (d) => d.year === activeYear && d.month === m
                  )?.count ?? 0
                  return (
                    <button
                      key={m}
                      onClick={() => count > 0 && onMonthClick(m)}
                      className={`flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
                        activeMonth === m
                          ? 'bg-violet-700 text-violet-100'
                          : count > 0
                            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            : 'cursor-default text-slate-700'
                      }`}
                    >
                      {name}
                      {count > 0 && (
                        <span className={`ml-1 text-[10px] ${activeMonth === m ? 'text-violet-300' : 'text-slate-600'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex flex-1 flex-wrap gap-1.5">
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
                <span className="self-center text-[11px] text-slate-600">{total} oppføringer</span>
              </div>
              <button
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className={`flex-shrink-0 rounded border px-2 py-0.5 text-xs transition-colors ${
                  selectMode
                    ? 'border-violet-600 bg-violet-800/50 text-violet-300'
                    : 'border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Velg oppføringer"
              >
                ☑
              </button>
              <div className="flex flex-shrink-0 gap-0.5 rounded border border-slate-700 p-0.5">
                <button
                  onClick={() => setView('list')}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${view === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Listevisning"
                >
                  ☰
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${view === 'grid' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Rutenettvisning"
                >
                  ⊞
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto p-3">
            {view === 'grid' ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    id={entry.id}
                    title={entry.title}
                    date={entry.date}
                    dateInferred={entry.dateInferred}
                    entryType={entry.entryType}
                    book={entry.book}
                    mood={entry.metadata?.mood ?? []}
                    topics={entry.metadata?.topics ?? []}
                    people={entry.metadata?.people ?? []}
                    snippet={null}
                    pageCount={entry._count.pages}
                    thumbnailPath={entry.pages[0]?.filePath ?? null}
                    compact
                    selectable={selectMode}
                    selected={selected.has(entry.id)}
                    onSelect={() => toggleSelect(entry.id)}
                  />
                ))}
              </div>
            ) : (
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
                    mood={entry.metadata?.mood ?? []}
                    topics={entry.metadata?.topics ?? []}
                    people={entry.metadata?.people ?? []}
                    snippet={entry.transcription?.correctedText ?? entry.transcription?.rawText ?? null}
                    pageCount={entry._count.pages}
                    thumbnailPath={entry.pages[0]?.filePath ?? null}
                    selectable={selectMode}
                    selected={selected.has(entry.id)}
                    onSelect={() => toggleSelect(entry.id)}
                  />
                ))}
              </div>
            )}
            {entries.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-600">Ingen oppføringer funnet</p>
            )}

            {/* Merge action bar */}
            {selectMode && selected.size > 0 && (
              <div className="sticky bottom-3 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-full border border-slate-600 bg-slate-900/95 px-4 py-2 shadow-xl backdrop-blur">
                  <span className="text-sm text-slate-300">{selected.size} valgt</span>
                  {selected.size >= 2 && (
                    <button
                      onClick={mergeSelected}
                      disabled={merging}
                      className="rounded-full bg-violet-700 px-3 py-1 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                      {merging ? 'Slår sammen...' : 'Slå sammen'}
                    </button>
                  )}
                  <button onClick={exitSelectMode} className="text-xs text-slate-500 hover:text-slate-300">
                    Avbryt
                  </button>
                </div>
              </div>
            )}
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
