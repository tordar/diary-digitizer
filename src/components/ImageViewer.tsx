'use client'
import { useState } from 'react'

interface ImageViewerProps {
  pages: { id: string; filePath: string; pageOrder: number }[]
}

// Helper to extract the relative path after the data root
const getImagePath = (filePath: string): string => {
  // filePath is like: /data/images/book1/file.jpg or ./data/images/file.jpg
  // We need: images/book1/file.jpg
  const match = filePath.match(/(?:\/|^)(images\/.+)$/)
  return match ? match[1] : filePath.split('/').slice(-2).join('/')
}

export function ImageViewer({ pages }: ImageViewerProps) {
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [activePage, setActivePage] = useState(0)

  const currentPage = pages[activePage]
  const imgSrc = currentPage ? `/api/images/${getImagePath(currentPage.filePath)}` : null

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 items-center justify-center bg-slate-950 p-4">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="Dagbokside"
            style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, maxHeight: '70vh', maxWidth: '100%' }}
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
        <button
          onClick={() => setZoom((z) => z >= 2.5 ? 1 : z + 0.5)}
          className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
        >
          🔍 Zoom
        </button>
        {pages.length > 1 && (
          <div className="flex gap-1 overflow-x-auto">
            {pages.map((page, i) => (
              <button
                key={page.id}
                onClick={() => { setActivePage(i); setRotation(0); setZoom(1) }}
                className={`flex-shrink-0 overflow-hidden rounded border-2 ${
                  i === activePage ? 'border-violet-500' : 'border-slate-700'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/images/${getImagePath(page.filePath)}`}
                  alt={`Side ${i + 1}`}
                  className="h-12 w-9 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
