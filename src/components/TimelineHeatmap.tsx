interface YearData {
  year: number
  count: number
}

interface TimelineHeatmapProps {
  data: YearData[]
  totalEntries: number
  totalPeople: number
  totalPlaces: number
}

export function TimelineHeatmap({ data, totalEntries, totalPeople, totalPlaces }: TimelineHeatmapProps) {
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <aside className="flex w-36 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 p-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tidslinje</p>
        <div className="flex flex-col gap-1">
          {data.map(({ year, count }) => {
            const intensity = Math.min(count / max, 1)
            return (
              <div key={year} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{year}</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-sm bg-blue-500"
                      style={{ opacity: intensity > i / 3 ? Math.max(0.1, intensity) : 0.1 }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Statistikk</p>
        <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
          <div>{totalEntries} oppføringer</div>
          <div>{totalPeople} personer</div>
          <div>{totalPlaces} steder</div>
        </div>
      </div>
    </aside>
  )
}
