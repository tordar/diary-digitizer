import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'
import { db } from '@/lib/db'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dagbok',
  description: 'Privat dagbokarkiv',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let reviewCount = 0
  try {
    reviewCount = await db.entry.count({ where: { status: 'pending_review' } })
  } catch {
    // DB not yet available (cold start, migrations pending, etc.)
  }

  return (
    <html lang="no" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Nav reviewCount={reviewCount} />
        <main>{children}</main>
      </body>
    </html>
  )
}
