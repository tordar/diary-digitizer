interface ReviewBarProps {
  entryId: string
  total: number
  current: number
  onApprove: () => void
  onSkip: () => void
}

export function ReviewBar({ entryId: _entryId, total, current, onApprove, onSkip }: ReviewBarProps) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-800 bg-amber-950/20 px-4 py-2">
      <span className="text-xs text-amber-400">⏳ Til gjennomgang</span>
      <span className="text-xs text-slate-500">{current} av {total}</span>
      <div className="flex-1" />
      <button onClick={onSkip} className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800">
        Hopp over
      </button>
      <button onClick={onApprove} className="rounded bg-green-700 px-3 py-1 text-xs text-white hover:bg-green-600">
        ✓ Godkjenn
      </button>
    </div>
  )
}
