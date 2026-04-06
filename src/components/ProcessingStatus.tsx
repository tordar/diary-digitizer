'use client'
import { useEffect, useState } from 'react'

interface JobStats {
  queued: number
  processing: number
  failed: number
}

export function ProcessingStatus() {
  const [stats, setStats] = useState<JobStats | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/jobs')
        if (res.ok) setStats(await res.json())
      } catch {
        // Silently ignore network errors — banner disappears until next successful poll
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  if (!stats) return null
  if (stats.queued === 0 && stats.processing === 0 && stats.failed === 0) return null

  const retryAll = async () => {
    await fetch('/api/jobs', { method: 'POST' })
    setStats((s) => s ? { ...s, failed: 0, queued: s.queued + s.failed } : s)
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs">
      {(stats.queued > 0 || stats.processing > 0) && (
        <span className="text-blue-400">
          ⚙ {stats.processing > 0 ? 'Behandler...' : ''} {stats.queued} i kø
        </span>
      )}
      {stats.failed > 0 && (
        <>
          <span className="text-red-400">✗ {stats.failed} feilet</span>
          <button onClick={retryAll} className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-600">
            Prøv igjen
          </button>
        </>
      )}
    </div>
  )
}
