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
    <aside className="hidden w-36 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 p-3 md:flex">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tidslinje</p>
        <div className="flex flex-col gap-1.5">
          {[...data].sort((a, b) => a.year - b.year).map(({ year, count }) => (
            <div key={year} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{year}</span>
                <span className="text-[10px] tabular-nums text-slate-600">{count}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-sm bg-slate-800">
                <div
                  className="h-full rounded-sm bg-blue-500"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
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
