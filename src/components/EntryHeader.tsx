'use client'
import { useState } from 'react'

interface EntryHeaderProps {
  entryId: string
  title: string | null
  date: string | null
  dateInferred: boolean
  bookName: string
  status: string
  displayDate: string
  onSaved: (title: string | null, date: string | null) => void
}

export function EntryHeader({
  entryId,
  title,
  date,
  dateInferred,
  bookName,
  status,
  displayDate,
  onSaved,
}: EntryHeaderProps) {
  const [editTitle, setEditTitle] = useState(title ?? '')
  const [editDate, setEditDate] = useState(date ? date.slice(0, 10) : '')

  const save = async () => {
    await fetch(`/api/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle || null, date: editDate || null }),
    })
    onSaved(editTitle || null, editDate || null)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Tittel (valgfritt)"
          className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-sm text-slate-100 focus:border-slate-400 focus:outline-none"
        />
        <input
          type="date"
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-sm text-slate-100 focus:border-slate-400 focus:outline-none"
        />
        <button
          onClick={save}
          className="rounded bg-violet-700 px-2 py-0.5 text-[11px] text-white hover:bg-violet-600"
        >
          Lagre
        </button>
      </div>
      <span className="text-xs text-slate-500">· {bookName}</span>
      <div className="flex-1" />
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${
        status === 'approved'
          ? 'bg-green-900/60 text-green-400'
          : 'bg-amber-900/60 text-amber-400'
      }`}>
        {status === 'approved' ? '✓ Godkjent' : '⏳ Til gjennomgang'}
      </span>
    </>
  )
}
