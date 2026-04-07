'use client'
import { useEffect, useState } from 'react'
import { ImageViewer } from '@/components/ImageViewer'
import { MetadataTags } from '@/components/MetadataTags'
import { ReviewBar } from '@/components/ReviewBar'

interface ReviewEntry {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  confidenceScore: number
  book: { name: string }
  pages: { id: string; filePath: string; pageOrder: number }[]
  transcription: { rawText: string; correctedText: string | null } | null
  metadata: { mood: string[]; topics: string[]; people: string[]; places: string[]; themes: string[] } | null
}

export default function ReviewPage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    fetch('/api/review').then((r) => r.json()).then(({ entries: e }) => setEntries(e))
  }, [])

  const entry = entries[current]

  const approve = async () => {
    if (!entry) return
    await fetch(`/api/review/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    setEntries((e) => e.filter((x) => x.id !== entry.id))
    setCurrent((c) => Math.min(c, entries.length - 2))
  }

  const skip = () => setCurrent((c) => Math.min(c + 1, entries.length - 1))

  const saveMetadata = async (metadata: {
    mood: string[]; topics: string[]; people: string[];
    places: string[]; themes: string[]
  }) => {
    if (!entry) return
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })
  }

  if (!entries.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Ingen oppføringer til gjennomgang 🎉</div>
  }

  if (!entry) return null

  const displayDate = entry.date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(entry.date))
    : 'Ukjent dato'

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      <ReviewBar entryId={entry.id} total={entries.length} current={current + 1} onApprove={approve} onSkip={skip} />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-5/12 flex-col border-r border-slate-800">
          <ImageViewer pages={entry.pages} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="font-medium text-slate-100">{entry.title ?? displayDate}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.book.name} · {Math.round(entry.confidenceScore * 100)}% sikkerhet · Lav tillit
              {entry.dateInferred && ' · Dato anslått'}
            </p>
          </div>
          <div className="flex-1 px-4 py-4">
            <p className="font-serif text-sm leading-relaxed text-slate-300">
              {entry.transcription?.correctedText ?? entry.transcription?.rawText ?? (
                <span className="italic text-slate-600">Ingen transkripsjon</span>
              )}
            </p>
          </div>
          {entry.metadata && (
            <MetadataTags
              key={entry.id}
              entryId={entry.id}
              mood={entry.metadata.mood}
              topics={entry.metadata.topics}
              people={entry.metadata.people}
              places={entry.metadata.places}
              themes={entry.metadata.themes}
              onSave={saveMetadata}
            />
          )}
        </div>
      </div>
    </div>
  )
}
