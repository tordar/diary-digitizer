'use client'

interface FilterOption {
  value: string
  label: string
  count: number
}

interface FilterSidebarProps {
  books: FilterOption[]
  moods: FilterOption[]
  entryTypes: FilterOption[]
  topics: FilterOption[]
  people: FilterOption[]
  places: FilterOption[]
  activeFilters: Record<string, string | undefined>
  onFilterChange: (key: string, value: string | null) => void
}

function FilterGroup({
  label, options, activeValue, filterKey, onChange,
}: {
  label: string
  options: FilterOption[]
  activeValue?: string
  filterKey: string
  onChange: (key: string, value: string | null) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(filterKey, activeValue === opt.value ? null : opt.value)}
            className={`flex items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
              activeValue === opt.value
                ? 'bg-violet-700 text-violet-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>{opt.label}</span>
            <span className={activeValue === opt.value ? 'text-violet-300' : 'text-slate-600'}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FilterSidebar({
  books, moods, entryTypes, topics, people, places,
  activeFilters, onFilterChange,
}: FilterSidebarProps) {
  return (
    <aside className="flex w-48 flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 p-3">
      <FilterGroup label="Bok" options={books} activeValue={activeFilters.bookId} filterKey="bookId" onChange={onFilterChange} />
      <FilterGroup label="Stemning" options={moods} activeValue={activeFilters.mood} filterKey="mood" onChange={onFilterChange} />
      <FilterGroup label="Type" options={entryTypes} activeValue={activeFilters.entryType} filterKey="entryType" onChange={onFilterChange} />
      <FilterGroup label="Temaer" options={topics.slice(0, 8)} activeValue={activeFilters.topic} filterKey="topic" onChange={onFilterChange} />
      <FilterGroup label="Personer" options={people.slice(0, 8)} activeValue={activeFilters.person} filterKey="person" onChange={onFilterChange} />
      <FilterGroup label="Steder" options={places.slice(0, 8)} activeValue={activeFilters.place} filterKey="place" onChange={onFilterChange} />
    </aside>
  )
}
