'use client'
import { useEffect, useState } from 'react'

interface Book {
  id: string; name: string; dateRange: string | null; folderHint: string | null
  _count: { entries: number; pages: number }
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch('/api/books').then((r) => r.json()).then(setBooks)
  }, [])

  const save = async (id: string) => {
    await fetch(`/api/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    setBooks((b) => b.map((book) => book.id === id ? { ...book, name: editName } : book))
    setEditing(null)
  }

  const create = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const book = await res.json()
    setBooks((b) => [...b, book])
    setNewName('')
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Bøker</h1>
      <div className="flex flex-col gap-2">
        {books.map((book) => (
          <div key={book.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            {editing === book.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                  onKeyDown={(e) => e.key === 'Enter' && save(book.id)}
                  autoFocus
                />
                <button onClick={() => save(book.id)} className="text-xs text-green-400 hover:text-green-300">Lagre</button>
                <button onClick={() => setEditing(null)} className="text-xs text-slate-500">Avbryt</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{book.name}</p>
                  <p className="text-xs text-slate-500">
                    {book._count.entries} oppføringer · {book._count.pages} sider
                    {book.folderHint && ` · ${book.folderHint}`}
                  </p>
                </div>
                <button
                  onClick={() => { setEditing(book.id); setEditName(book.name) }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Gi nytt navn
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ny bok..."
          onKeyDown={(e) => e.key === 'Enter' && create()}
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
        />
        <button onClick={create} className="rounded bg-violet-700 px-4 py-2 text-sm text-white hover:bg-violet-600">
          + Legg til
        </button>
      </div>
    </div>
  )
}
