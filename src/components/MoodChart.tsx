'use client'

const PALETTE = [
  '#818cf8', '#86efac', '#67e8f9', '#fcd34d',
  '#fb923c', '#fca5a5', '#d8b4fe', '#6ee7b7',
]

interface DataPoint { year: number; mood: string; count: number }

export function MoodChart({ data }: { data: DataPoint[] }) {
  const totals = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.mood] = (acc[d.mood] ?? 0) + d.count
    return acc
  }, {})

  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  if (ranked.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Topp stemninger</p>
        <p className="text-sm text-slate-600">Ingen data ennå</p>
      </div>
    )
  }

  const max = ranked[0][1]

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Topp stemninger</p>
      <div className="flex flex-col gap-2.5">
        {ranked.map(([mood, count], i) => (
          <div key={mood} className="flex items-center gap-3">
            <span className="w-24 flex-shrink-0 text-right text-xs text-slate-400">{mood}</span>
            <div className="flex h-4 flex-1 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full rounded"
                style={{ width: `${(count / max) * 100}%`, background: PALETTE[i % PALETTE.length] }}
              />
            </div>
            <span className="w-6 flex-shrink-0 text-right text-xs tabular-nums text-slate-500">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
