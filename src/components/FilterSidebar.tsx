'use client'
import { useState } from 'react'

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
  mobileOpen?: boolean
  onClose?: () => void
}

function FilterGroup({
  label, options, activeValue, filterKey, onChange, collapsible = false,
}: {
  label: string
  options: FilterOption[]
  activeValue?: string
  filterKey: string
  onChange: (key: string, value: string | null) => void
  collapsible?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const sorted = collapsible
    ? [...options].sort((a, b) => b.count - a.count)
    : options

  const visible = collapsible && !expanded ? sorted.slice(0, 5) : sorted
  const hasMore = collapsible && sorted.length > 5

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {visible.map((opt) => (
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
        {hasMore && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-0.5 px-2 py-1 text-left text-[11px] text-slate-600 hover:text-slate-400"
          >
            {expanded ? 'Vis mindre ↑' : `+${sorted.length - 5} til ↓`}
          </button>
        )}
      </div>
    </div>
  )
}

export function FilterSidebar({
  books, moods, entryTypes, topics, people, places,
  activeFilters, onFilterChange, mobileOpen, onClose,
}: FilterSidebarProps) {
  const content = (
    <>
      <FilterGroup label="Bok" options={books} activeValue={activeFilters.bookId} filterKey="bookId" onChange={onFilterChange} />
      <FilterGroup label="Stemning" options={moods.filter((o) => o.count > 0)} activeValue={activeFilters.mood} filterKey="mood" onChange={onFilterChange} collapsible />
      <FilterGroup label="Type" options={entryTypes} activeValue={activeFilters.entryType} filterKey="entryType" onChange={onFilterChange} />
      <FilterGroup label="Temaer" options={topics} activeValue={activeFilters.topic} filterKey="topic" onChange={onFilterChange} collapsible />
      <FilterGroup label="Personer" options={people} activeValue={activeFilters.person} filterKey="person" onChange={onFilterChange} collapsible />
      <FilterGroup label="Steder" options={places} activeValue={activeFilters.place} filterKey="place" onChange={onFilterChange} collapsible />
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-48 flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 p-3 md:flex">
        {content}
      </aside>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[80vh] flex-col rounded-t-xl border-t border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-medium text-slate-200">Filter</span>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">×</button>
            </div>
            <div className="flex flex-col gap-5 overflow-y-auto p-4">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
