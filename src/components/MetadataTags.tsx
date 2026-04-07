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

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-2.5 py-0.5 text-[11px] ${color}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MetadataTags({ entryId: _entryId, mood, topics, people, places, themes, onSave }: MetadataTagsProps) {
  const [editing, setEditing] = useState(false)
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
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Rediger metadata</span>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300">Avbryt</button>
        </div>
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

  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Metadata</span>
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-slate-500 hover:text-slate-300"
        >
          ✏️ Rediger
        </button>
      </div>
      {mood.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Stemning</span>
          <div className="flex flex-wrap gap-1.5">
            {mood.map((m) => (
              <span key={m} className="w-fit rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] text-slate-200">
                {moodEmoji[m] ?? '💭'} {m}
              </span>
            ))}
          </div>
        </div>
      )}
      <TagList label="Temaer" items={topics} color="bg-blue-900/60 text-blue-300" />
      <TagList label="Personer" items={people} color="bg-violet-900/60 text-violet-300" />
      <TagList label="Steder" items={places} color="bg-emerald-900/60 text-emerald-300" />
      <TagList label="Temaer (overordnet)" items={themes} color="bg-amber-900/60 text-amber-300" />
    </div>
  )
}
