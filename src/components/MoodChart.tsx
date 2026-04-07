'use client'

interface DataPoint { year: number; mood: string; count: number }

const PALETTE = [
  '#818cf8', '#86efac', '#67e8f9', '#fcd34d',
  '#fb923c', '#fca5a5', '#d8b4fe', '#6ee7b7',
]

export function MoodChart({ data }: { data: DataPoint[] }) {
  const years = [...new Set(data.map((d) => d.year))].sort()

  // Find top 7 moods by total count across all years
  const totals = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.mood] = (acc[d.mood] ?? 0) + d.count
    return acc
  }, {})
  const topMoods = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([mood]) => mood)

  const colorOf = (mood: string) => {
    const i = topMoods.indexOf(mood)
    return i >= 0 ? PALETTE[i] : '#334155'
  }

  if (years.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Stemning over tid</p>
        <p className="text-sm text-slate-600">Ingen data ennå</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Stemning over tid</p>
      <div className="flex items-end gap-2">
        {years.map((year) => {
          const yearData = data.filter((d) => d.year === year)
          const total = yearData.reduce((s, d) => s + d.count, 0)

          // Build segments: top moods + "andre" for the rest
          const segments: { mood: string; count: number }[] = topMoods.map((mood) => ({
            mood,
            count: yearData.find((d) => d.mood === mood)?.count ?? 0,
          }))
          const topCount = segments.reduce((s, seg) => s + seg.count, 0)
          const otherCount = total - topCount
          if (otherCount > 0) segments.push({ mood: 'andre', count: otherCount })

          return (
            <div key={year} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: 80 }}>
                {segments.map((seg) => {
                  const pct = total > 0 ? (seg.count / total) * 100 : 0
                  return (
                    <div
                      key={seg.mood}
                      style={{ height: `${pct}%`, background: colorOf(seg.mood) }}
                      title={`${seg.mood}: ${seg.count}`}
                    />
                  )
                })}
              </div>
              <span className="text-[10px] text-slate-600">{year}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {topMoods.map((mood) => (
          <div key={mood} className="flex items-center gap-1.5">
            <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: colorOf(mood) }} />
            <span className="text-[11px] text-slate-500">{mood}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
