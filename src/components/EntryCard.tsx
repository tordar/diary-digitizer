import Link from 'next/link'

const moodEmoji: Record<string, string> = {
  glad: '😄', nøytral: '🙂', lav: '😔', blandet: '😤',
}

const typeIcon: Record<string, string> = {
  text: '📝', image: '🖼', mixed: '✏️', special: '📋',
}

interface EntryCardProps {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  book: { name: string }
  mood: string | null
  topics: string[]
  people: string[]
  snippet: string | null
  pageCount: number
  thumbnailPath: string | null
}

export function EntryCard({
  id, title, date, dateInferred, entryType, book,
  mood, topics, people, snippet, pageCount, thumbnailPath,
}: EntryCardProps) {
  const displayDate = date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date))
    : 'Ukjent dato'

  return (
    <Link href={`/entries/${id}`}>
      <article className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/60">
        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-lg">
          {thumbnailPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${thumbnailPath}`} alt="" className="h-full w-full rounded object-cover" />
          ) : (
            typeIcon[entryType] ?? '📄'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-100">
              {title ?? displayDate}
            </span>
            {mood && <span className="flex-shrink-0 text-sm">{moodEmoji[mood]}</span>}
          </div>
          {title && (
            <p className="text-xs text-slate-500">
              {displayDate}{dateInferred && ' (anslått)'}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            {book.name}
            {pageCount > 1 && ` · ${pageCount} sider`}
            {topics.length > 0 && ` · ${topics.slice(0, 2).join(', ')}`}
          </p>
          {snippet && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
              {snippet}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}
