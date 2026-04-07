'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

interface Book { id: string; name: string }
interface PendingFolder { bookId: string; folderHint: string | null; bookName: string; pageCount: number }

export default function UploadPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([])
  const [pendingFolders, setPendingFolders] = useState<PendingFolder[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadBooks = useCallback(() =>
    fetch('/api/books').then((r) => r.json()).then(setBooks), [])

  const loadPending = useCallback(() =>
    fetch('/api/pending-folders').then((r) => r.json()).then((d) => setPendingFolders(d.folders)), [])

  useEffect(() => {
    loadBooks()
    loadPending()
  }, [loadBooks, loadPending])

  const upload = async () => {
    if (!files.length) return
    setUploading(true)
    const form = new FormData()
    for (const f of files) form.append('files', f)
    // When uploading manually via this form, always require explicit book selection
    // (handled by pending-folders flow after upload)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { results: r } = await res.json()
    setResults(r)
    setFiles([])
    setUploading(false)
    loadPending()
    loadBooks()
  }

  const assign = async (tempBookId: string) => {
    const targetBookId = assignments[tempBookId]
    if (!targetBookId) return
    setAssigning(tempBookId)
    await fetch('/api/pending-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempBookId, targetBookId }),
    })
    setAssigning(null)
    loadPending()
    loadBooks()
  }

  const createAndAssign = async (tempBookId: string, name: string) => {
    // Create a new book then assign
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const newBook = await res.json()
    setAssigning(tempBookId)
    await fetch('/api/pending-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempBookId, targetBookId: newBook.id }),
    })
    setAssigning(null)
    loadPending()
    loadBooks()
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Last opp sider</h1>

      {/* Pending folder assignments */}
      {pendingFolders.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-amber-400">Mapper som venter på boktilknytning</h2>
          <div className="flex flex-col gap-3">
            {pendingFolders.map((folder) => (
              <PendingFolderRow
                key={folder.bookId}
                folder={folder}
                books={books}
                value={assignments[folder.bookId] ?? ''}
                onChange={(v) => setAssignments((a) => ({ ...a, [folder.bookId]: v }))}
                onAssign={() => assign(folder.bookId)}
                onCreateAndAssign={(name) => createAndAssign(folder.bookId, name)}
                loading={assigning === folder.bookId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload new files */}
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
        {uploading ? 'Laster opp...' : 'Last opp'}
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

function PendingFolderRow({
  folder, books, value, onChange, onAssign, onCreateAndAssign, loading,
}: {
  folder: PendingFolder
  books: Book[]
  value: string
  onChange: (v: string) => void
  onAssign: () => void
  onCreateAndAssign: (name: string) => void
  loading: boolean
}) {
  const [newBookName, setNewBookName] = useState(folder.folderHint ?? '')
  const isNew = value === '__new__'

  return (
    <div className="rounded-lg border border-amber-900/50 bg-slate-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">
          {folder.folderHint ?? folder.bookName}
        </span>
        <span className="text-xs text-slate-500">{folder.pageCount} sider</span>
      </div>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">Velg bok...</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          <option value="__new__">+ Opprett ny bok</option>
        </select>
        {isNew ? (
          <input
            value={newBookName}
            onChange={(e) => setNewBookName(e.target.value)}
            placeholder="Bokens navn"
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
          />
        ) : null}
        <button
          onClick={() => isNew ? onCreateAndAssign(newBookName) : onAssign()}
          disabled={loading || (!isNew && !value) || (isNew && !newBookName)}
          className="rounded bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-40"
        >
          {loading ? '...' : 'Tilordne'}
        </button>
      </div>
    </div>
  )
}
