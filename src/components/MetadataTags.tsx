'use client'
import { useState } from 'react'

interface MetadataTagsProps {
  entryId: string
  mood: string[]
  topics: string[]
  people: string[]
  places: string[]
  themes: string[]
  onSave: (data: { mood: string[]; topics: string[]; people: string[]; places: string[]; themes: string[] }) => Promise<void>
}

const MOODS = [
  'glad', 'lettet', 'takknemlig', 'spent', 'optimistisk', 'stolt', 'energisk', 'inspirert',
  'rolig', 'nostalgisk', 'trist', 'ensom', 'frustrert', 'sint', 'engstelig', 'utmattet',
  'overveldet', 'nedfor', 'skuffet', 'urolig', 'selvkritisk', 'reflektert', 'ambivalent',
  'søkende', 'usikker', 'melankolsk', 'sårbar', 'lengtende', 'bekymret', 'håpefull',
  'nøytral', 'observerende',
]
const moodEmoji: Record<string, string> = {
  glad: '😄', lettet: '😮‍💨', takknemlig: '🙏', spent: '😬', optimistisk: '🌟',
  stolt: '💪', energisk: '⚡', inspirert: '✨', rolig: '😌', nostalgisk: '🕰️',
  trist: '😢', ensom: '🌑', frustrert: '😤', sint: '😠', engstelig: '😰',
  utmattet: '😴', overveldet: '🌊', nedfor: '😞', skuffet: '😕', urolig: '😟',
  selvkritisk: '🪞', reflektert: '🤔', ambivalent: '⚖️', søkende: '🔍', usikker: '❓',
  melankolsk: '🌧️', sårbar: '🫀', lengtende: '🌅', bekymret: '😟', håpefull: '🌱',
  nøytral: '😐', observerende: '👁️',
}


export function MetadataTags({ entryId: _entryId, mood, topics, people, places, themes, onSave }: MetadataTagsProps) {
  const [localMood, setLocalMood] = useState<string[]>(mood)
  const [localTopics, setLocalTopics] = useState(topics.join(', '))
  const [localPeople, setLocalPeople] = useState(people.join(', '))
  const [localPlaces, setLocalPlaces] = useState(places.join(', '))
  const [localThemes, setLocalThemes] = useState(themes.join(', '))

  const parseTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean)

  const save = async () => {
    await onSave({
      mood: localMood,
      topics: parseTags(localTopics),
      people: parseTags(localPeople),
      places: parseTags(localPlaces),
      themes: parseTags(localThemes),
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Metadata</span>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Stemning</span>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setLocalMood((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])}
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                localMood.includes(m) ? 'bg-violet-700 text-violet-100' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {moodEmoji[m]} {m}
            </button>
          ))}
        </div>
      </div>
      {[
        { label: 'Temaer', value: localTopics, set: setLocalTopics },
        { label: 'Personer', value: localPeople, set: setLocalPeople },
        { label: 'Steder', value: localPlaces, set: setLocalPlaces },
        { label: 'Temaer (overordnet)', value: localThemes, set: setLocalThemes },
      ].map(({ label, value, set }) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
          <input
            value={value}
            onChange={(e) => set(e.target.value)}
            placeholder="Kommaseparert liste"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
          />
        </div>
      ))}
      <button
        onClick={save}
        className="self-start rounded bg-violet-700 px-4 py-1.5 text-xs text-white hover:bg-violet-600"
      >
        Lagre
      </button>
    </div>
  )
}
