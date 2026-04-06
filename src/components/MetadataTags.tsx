'use client'

interface MetadataTagsProps {
  entryId: string
  mood: string | null
  topics: string[]
  people: string[]
  places: string[]
  themes: string[]
  onSave: (data: { mood: string | null; topics: string[]; people: string[]; places: string[]; themes: string[] }) => Promise<void>
}

const moodEmoji: Record<string, string> = { glad: '😄', nøytral: '🙂', lav: '😔', blandet: '😤' }

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

export function MetadataTags({ entryId: _entryId, mood, topics, people, places, themes, onSave: _onSave }: MetadataTagsProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
      {mood && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Stemning</span>
          <span className="w-fit rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] text-slate-200">
            {moodEmoji[mood]} {mood}
          </span>
        </div>
      )}
      <TagList label="Temaer" items={topics} color="bg-blue-900/60 text-blue-300" />
      <TagList label="Personer" items={people} color="bg-violet-900/60 text-violet-300" />
      <TagList label="Steder" items={places} color="bg-emerald-900/60 text-emerald-300" />
      <TagList label="Temaer (overordnet)" items={themes} color="bg-amber-900/60 text-amber-300" />
    </div>
  )
}
