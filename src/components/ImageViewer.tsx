'use client'
import { useState } from 'react'

interface ImageViewerProps {
  pages: { id: string; filePath: string; pageOrder: number }[]
}

export function ImageViewer({ pages }: ImageViewerProps) {
  const [rotation, setRotation] = useState(0)
  const [activePage, setActivePage] = useState(0)

  const currentPage = pages[activePage]
  const imgSrc = currentPage
    ? `/api/images/${currentPage.filePath.split('/data/').pop()}`
    : null

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 items-center justify-center bg-slate-950 p-4">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="Dagbokside"
            style={{ transform: `rotate(${rotation}deg)`, maxHeight: '70vh', maxWidth: '100%' }}
            className="rounded object-contain shadow-lg transition-transform duration-200"
          />
        ) : (
          <div className="text-slate-600">Ingen bilde</div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-slate-800 p-2">
        <button
          onClick={() => setRotation((r) => r - 90)}
          className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
        >
          ↺ Roter
        </button>
        {pages.length > 1 &&
          pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setActivePage(i)}
              className={`h-1.5 w-1.5 rounded-full ${i === activePage ? 'bg-violet-500' : 'bg-slate-700'}`}
            />
          ))}
      </div>
    </div>
  )
}
