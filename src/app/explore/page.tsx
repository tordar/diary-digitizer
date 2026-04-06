'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoodChart } from '@/components/MoodChart'

interface ExploreData {
  moodByYear: { year: number; mood: string; count: number }[]
  topPeople: { person: string; count: number }[]
  topPlaces: { place: string; count: number }[]
  topTopics: { topic: string; count: number }[]
  bookStats: { id: string; name: string; _count: { entries: number } }[]
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
          <div className="flex flex-col gap-2">
            {data.bookStats.map((book) => (
              <div key={book.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-200">{book.name}</span>
                <span className="text-xs text-slate-500">{book._count.entries} oppføringer</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
