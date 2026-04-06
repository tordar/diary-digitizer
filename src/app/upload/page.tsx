'use client'
import { useEffect, useState, useRef } from 'react'

interface Book { id: string; name: string }

export default function UploadPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/books').then((r) => r.json()).then(setBooks)
  }, [])

  const upload = async () => {
    if (!files.length) return
    setUploading(true)
    const form = new FormData()
    for (const f of files) form.append('files', f)
    if (selectedBookId) form.append('bookId', selectedBookId)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { results: r } = await res.json()
    setResults(r)
    setFiles([])
    setUploading(false)
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Last opp sider</h1>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs text-slate-400">Tilordne til bok (valgfritt)</label>
        <select
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">Automatisk (basert på mappestruktur)</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 transition-colors hover:border-slate-500"
      >
        <p className="text-sm text-slate-400">Klikk for å velge filer, eller dra og slipp</p>
        <p className="mt-1 text-xs text-slate-600">JPG, PNG, HEIC, PDF</p>
        {files.length > 0 && (
          <p className="mt-2 text-xs text-violet-400">{files.length} filer valgt</p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.heic,.pdf"
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <button
        onClick={upload}
        disabled={uploading || !files.length}
        className="w-full rounded bg-violet-700 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
      >
        {uploading ? 'Laster opp...' : 'Last opp og behandle'}
      </button>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          {results.map((r) => (
            <div key={r.name} className={`text-xs ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
              {r.ok ? '✓' : '✗'} {r.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
