'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Bla gjennom' },
  { href: '/explore', label: 'Utforsk' },
  { href: '/review', label: 'Gjennomgå' },
  { href: '/upload', label: 'Last opp' },
  { href: '/books', label: 'Bøker' },
  { href: '/settings', label: 'Innstillinger' },
]

export function Nav({ reviewCount }: { reviewCount?: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950 px-4 py-2">
      <span className="mr-4 flex-shrink-0 text-sm font-bold text-slate-100">📓 Dagbok</span>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`rounded px-3 py-1.5 text-xs transition-colors ${
            pathname === href
              ? 'bg-violet-700 text-violet-100'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {label}
          {href === '/review' && reviewCount ? (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
              {reviewCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
