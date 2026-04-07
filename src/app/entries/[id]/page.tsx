'use client'
// MARKER_XQ7Z9
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageViewer } from '@/components/ImageViewer'
import { MetadataTags } from '@/components/MetadataTags'
import { EntryHeader } from '@/components/EntryHeader'

interface EntryData {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  status: string
  confidenceScore: number
  book: { name: string }
  pages: { id: string; filePath: string; pageOrder: number }[]
  transcription: { rawText: string; correctedText: string | null } | null
  metadata: {
    mood: string[]; topics: string[]; people: string[];
    places: string[]; themes: string[]
  } | null
}

export default function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [entry, setEntry] = useState<EntryData | null>(null)
  const [editing, setEditing] = useState(false)
  const [correctedText, setCorrectedText] = useState('')
  const [adjacentIds, setAdjacentIds] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/entries/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEntry(data)
        setCorrectedText(data.transcription?.correctedText ?? data.transcription?.rawText ?? '')
      })

    // Fetch entry list to get prev/next IDs
    fetch(`/api/entries?limit=2000`)
      .then((r) => r.json())
      .then(({ entries: list }: { entries: { id: string }[] }) => {
        const idx = list.findIndex((e) => e.id === id)
        setAdjacentIds({
          prev: idx > 0 ? list[idx - 1].id : null,
          next: idx < list.length - 1 ? list[idx + 1].id : null,
        })
      })
  }, [id])

  const saveCorrection = async () => {
    await fetch(`/api/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctedText }),
    })
    setEditing(false)
    setEntry((e) => e ? {
      ...e,
      transcription: e.transcription ? { ...e.transcription, correctedText } : null,
    } : null)
  }

  const saveMetadata = async (metadata: {
    mood: string[]; topics: string[]; people: string[];
    places: string[]; themes: string[]
  }) => {
    await fetch(`/api/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })
    setEntry((e) => e ? { ...e, metadata } : null)
  }

  if (!entry) return <div className="p-8 text-slate-400">Laster...</div>

  const displayDate = entry.date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(entry.date))
    : 'Ukjent dato'

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-300">
          ← Tilbake
        </button>
        <span className="text-slate-700">|</span>
        <EntryHeader
          entryId={id}
          title={entry.title}
          date={entry.date}
          dateInferred={entry.dateInferred}
          bookName={entry.book.name}
          status={entry.status}
          displayDate={displayDate}
          onSaved={(title, date) => setEntry((e) => e ? { ...e, title, date } : null)}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-5/12 flex-col border-r border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Skannet side
          </div>
          <ImageViewer pages={entry.pages} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Transkripsjon
            </span>
            <span className="flex-1" />
            <span className="text-[11px] text-slate-500">
              {Math.round(entry.confidenceScore * 100)}% sikkerhet
            </span>
            <button
              onClick={() => setEditing((e) => !e)}
              className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
            >
              {editing ? 'Avbryt' : '✏️ Rediger'}
            </button>
          </div>

          <div className="flex-1 px-4 py-4">
            {editing ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={correctedText}
                  onChange={(e) => setCorrectedText(e.target.value)}
                  className="h-64 w-full rounded border border-slate-700 bg-slate-900 p-3 font-serif text-sm leading-relaxed text-slate-200 focus:border-slate-500 focus:outline-none"
                />
                <button
                  onClick={saveCorrection}
                  className="self-start rounded bg-violet-700 px-4 py-1.5 text-sm text-white hover:bg-violet-600"
                >
                  Lagre
                </button>
              </div>
            ) : (
              <p className="font-serif text-sm leading-relaxed text-slate-300">
                {entry.transcription?.correctedText ?? entry.transcription?.rawText ?? (
                  <span className="italic text-slate-600">Ingen transkripsjon</span>
                )}
              </p>
            )}
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

          <div className="flex justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
            <button
              onClick={() => adjacentIds.prev && router.push(`/entries/${adjacentIds.prev}`)}
              disabled={!adjacentIds.prev}
              className="hover:text-slate-300 disabled:opacity-30"
            >
              ← Forrige
            </button>
            <button
              onClick={() => adjacentIds.next && router.push(`/entries/${adjacentIds.next}`)}
              disabled={!adjacentIds.next}
              className="hover:text-slate-300 disabled:opacity-30"
            >
              Neste →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
