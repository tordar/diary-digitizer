import Link from 'next/link'

const moodEmoji: Record<string, string> = {
  glad: '😄', lettet: '😮‍💨', takknemlig: '🙏', spent: '😬', optimistisk: '🌟',
  stolt: '💪', energisk: '⚡', inspirert: '✨', rolig: '😌', nostalgisk: '🕰️',
  trist: '😢', ensom: '🌑', frustrert: '😤', sint: '😠', engstelig: '😰',
  utmattet: '😴', overveldet: '🌊', nedfor: '😞', skuffet: '😕', urolig: '😟',
  selvkritisk: '🪞', reflektert: '🤔', ambivalent: '⚖️', søkende: '🔍', usikker: '❓',
  melankolsk: '🌧️', sårbar: '🫀', lengtende: '🌅', bekymret: '😟', håpefull: '🌱',
  nøytral: '😐', observerende: '👁️',
}

const typeIcon: Record<string, string> = {
  text: '📝', image: '🖼', mixed: '✏️', special: '📋',
}

function thumbnailSrc(filePath: string) {
  return `/api/images/${filePath.includes('/images/') ? filePath.substring(filePath.indexOf('/images/') + 1) : filePath}`
}

interface EntryCardProps {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  book: { name: string }
  mood: string[]
  topics: string[]
  people: string[]
  snippet: string | null
  pageCount: number
  thumbnailPath: string | null
  compact?: boolean
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
}

export function EntryCard({
  id, title, date, dateInferred, entryType, book,
  mood, topics, people, snippet, pageCount, thumbnailPath, compact,
  selectable, selected, onSelect,
}: EntryCardProps) {
  const displayDate = date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date))
    : 'Ukjent dato'

  if (compact) {
    const inner = (
      <article
        onClick={selectable ? onSelect : undefined}
        className={`group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border transition-colors ${
          selected
            ? 'border-violet-500 ring-2 ring-violet-500'
            : 'border-slate-800 hover:border-slate-600'
        } bg-slate-900`}
      >
        {thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailSrc(thumbnailPath)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-slate-600">
            {typeIcon[entryType] ?? '📄'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
          <p className="truncate text-[11px] font-medium leading-tight text-white">
            {title ?? displayDate}
          </p>
          {title && <p className="truncate text-[10px] text-slate-400">{displayDate}</p>}
        </div>
        {mood.length > 0 && (
          <span className="absolute right-1 top-1 text-sm drop-shadow">{moodEmoji[mood[0]] ?? '💭'}</span>
        )}
        {pageCount > 1 && (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] text-slate-300">
            <span>⊞</span>{pageCount}
          </span>
        )}
        {selectable && (
          <span className={`absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
            selected ? 'border-violet-400 bg-violet-500 text-white' : 'border-slate-400 bg-black/50'
          }`}>
            {selected && '✓'}
          </span>
        )}
      </article>
    )
    return selectable ? inner : <Link href={`/entries/${id}`}>{inner}</Link>
  }

  const inner = (
    <article
      onClick={selectable ? onSelect : undefined}
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-violet-500 bg-violet-900/20 ring-1 ring-violet-500'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/60'
      }`}
    >
      {selectable && (
        <div className="flex flex-shrink-0 items-center">
          <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
            selected ? 'border-violet-400 bg-violet-500 text-white' : 'border-slate-600 bg-slate-800'
          }`}>
            {selected && '✓'}
          </span>
        </div>
      )}
      <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-lg relative">
        {thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailSrc(thumbnailPath)} alt="" className="h-full w-full rounded object-cover" />
        ) : (
          typeIcon[entryType] ?? '📄'
        )}
        {pageCount > 1 && (
          <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-slate-700 px-1 text-[9px] text-slate-300 leading-tight min-w-[16px]">
            {pageCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-100">
            {title ?? displayDate}
          </span>
          {mood.length > 0 && <span className="flex-shrink-0 text-sm">{moodEmoji[mood[0]] ?? '💭'}</span>}
        </div>
        {title && (
          <p className="text-xs text-slate-500">
            {displayDate}{dateInferred && ' (anslått)'}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-500">
          {book.name}
          {topics.length > 0 && ` · ${topics.slice(0, 2).join(', ')}`}
        </p>
        {snippet && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {snippet}
          </p>
        )}
      </div>
    </article>
  )
  return selectable ? inner : <Link href={`/entries/${id}`}>{inner}</Link>
}
