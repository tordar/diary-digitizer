'use client'

interface DataPoint { year: number; mood: string; count: number }

const moodColor: Record<string, string> = {
  glad: '#86efac', nøytral: '#94a3b8', lav: '#fca5a5', blandet: '#fcd34d',
}

export function MoodChart({ data }: { data: DataPoint[] }) {
  const years = [...new Set(data.map((d) => d.year))].sort()
  const moods = ['glad', 'nøytral', 'lav', 'blandet']

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Stemning over tid</p>
      <div className="flex items-end gap-2">
        {years.map((year) => {
          const yearData = data.filter((d) => d.year === year)
          const total = yearData.reduce((s, d) => s + d.count, 0)
          return (
            <div key={year} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: 80 }}>
                {moods.map((mood) => {
                  const val = yearData.find((d) => d.mood === mood)?.count ?? 0
                  const pct = total > 0 ? (val / total) * 100 : 0
                  return (
                    <div
                      key={mood}
                      style={{ height: `${pct}%`, background: moodColor[mood] }}
                      title={`${mood}: ${val}`}
                    />
                  )
                })}
              </div>
              <span className="text-[10px] text-slate-600">{year}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {moods.map((mood) => (
          <div key={mood} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: moodColor[mood] }} />
            <span className="text-[11px] text-slate-500">{mood}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
