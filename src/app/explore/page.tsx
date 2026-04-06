'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoodChart } from '@/components/MoodChart'

interface ExploreData {
  moodByYear: { year: number; mood: string; count: number }[]
  topPeople: { person: string; count: number }[]
  topPlaces: { place: string; count: number }[]
  topTopics: { topic: string; count: number }[]
  bookStats: { id: string; name: string; dateRange: string | null; _count: { entries: number } }[]
  bookMoods: { book_id: string; mood: string; count: number }[]
}

function TagCloud({ items, label, filterKey }: {
  items: { value: string; count: number }[]
  label: string
  filterKey: string
}) {
  const router = useRouter()
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ value, count }) => {
          const size = 10 + (count / max) * 8
          return (
            <button
              key={value}
              onClick={() => router.push(`/?${filterKey}=${encodeURIComponent(value)}`)}
              className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300 transition-colors hover:bg-slate-700"
              style={{ fontSize: size }}
            >
              {value}
              <span className="ml-1 text-slate-600" style={{ fontSize: 9 }}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  const [data, setData] = useState<ExploreData | null>(null)

  useEffect(() => {
    fetch('/api/explore').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="p-8 text-slate-400">Laster...</div>

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Utforsk</h1>
      <div className="flex flex-col gap-6">
        <MoodChart data={data.moodByYear} />
        <TagCloud items={data.topPeople.map((p) => ({ value: p.person, count: p.count }))} label="Personer" filterKey="person" />
        <TagCloud items={data.topPlaces.map((p) => ({ value: p.place, count: p.count }))} label="Steder" filterKey="place" />
        <TagCloud items={data.topTopics.map((t) => ({ value: t.topic, count: t.count }))} label="Temaer" filterKey="topic" />
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Bøker</p>
          <div className="flex flex-col gap-3">
            {data.bookStats.map((book) => {
              const moods = data.bookMoods.filter((m) => m.book_id === book.id)
              const moodColors: Record<string, string> = { glad: '#86efac', nøytral: '#94a3b8', lav: '#fca5a5', blandet: '#fcd34d' }
              const total = moods.reduce((s, m) => s + m.count, 0)
              return (
                <div key={book.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">{book.name}</span>
                    <span className="text-xs text-slate-500">{book._count.entries} oppføringer</span>
                  </div>
                  {book.dateRange && (
                    <span className="text-[11px] text-slate-500">{book.dateRange}</span>
                  )}
                  {moods.length > 0 && (
                    <div className="flex h-2 w-full overflow-hidden rounded" title={moods.map((m) => `${m.mood}: ${m.count}`).join(', ')}>
                      {moods.map((m) => (
                        <div
                          key={m.mood}
                          style={{
                            width: `${(m.count / total) * 100}%`,
                            background: moodColors[m.mood] ?? '#475569',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
