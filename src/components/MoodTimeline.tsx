'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const SENTIMENT_GROUPS = [
  {
    name:  'Positiv',
    moods: new Set([
      'glad', 'energisk', 'optimistisk', 'takknemlig', 'håpefull',
      'inspirert', 'stolt', 'lettet', 'romantisk', 'eventyrlysten',
    ]),
    color: '#86efac',
  },
  {
    name:  'Rolig',
    moods: new Set(['rolig', 'reflektert', 'observerende', 'nøytral']),
    color: '#93c5fd',
  },
  {
    name:  'Søkende',
    moods: new Set([
      'nostalgisk', 'lengtende', 'sårbar', 'søkende',
      'ambivalent', 'melankolsk', 'spent',
    ]),
    color: '#d8b4fe',
  },
  {
    name:  'Krevende',
    moods: new Set([
      'trist', 'utmattet', 'frustrert', 'engstelig',
      'urolig', 'kritisk', 'selvkritisk',
    ]),
    color: '#f87171',
  },
]

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des']

interface MoodPoint      { year: number; month: number; mood: string; count: number }
interface EntryPoint     { year: number; month: number; count: number }
interface YearMoodPoint  { year: number; mood: string; count: number }
interface YearEntryPoint { year: number; count: number }

export function MoodTimeline({
  data,
  entryData,
  yearData,
  entryYearData,
}: {
  data: MoodPoint[]
  entryData: EntryPoint[]
  yearData: YearMoodPoint[]
  entryYearData: YearEntryPoint[]
}) {
  const [mode, setMode] = useState<'month' | 'year'>('month')

  if (data.length === 0 && yearData.length === 0) return null

  let chartData: Record<string, string | number>[]

  if (mode === 'year') {
    const years = [...new Set(yearData.map((d) => d.year))].sort()
    chartData = years.map((year) => {
      const row: Record<string, string | number> = { label: String(year) }
      const groupTotals = SENTIMENT_GROUPS.map((group) => ({
        name: group.name,
        total: yearData
          .filter((d) => d.year === year && group.moods.has(d.mood))
          .reduce((sum, d) => sum + d.count, 0),
      }))
      const grandTotal = groupTotals.reduce((sum, g) => sum + g.total, 0)
      for (const { name, total } of groupTotals) {
        row[name] = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
      }
      return row
    })
  } else {
    const buckets = [...new Set(data.map((d) => `${d.year}-${String(d.month).padStart(2, '0')}`))]
      .sort()
      .map((key) => {
        const [year, month] = key.split('-').map(Number)
        return { year, month }
      })

    chartData = buckets.map(({ year, month }) => {
      const shortYear = String(year).slice(2)
      const row: Record<string, string | number> = {
        label: `${MONTH_LABELS[month - 1]} '${shortYear}`,
      }
      const groupTotals = SENTIMENT_GROUPS.map((group) => ({
        name: group.name,
        total: data
          .filter((d) => d.year === year && d.month === month && group.moods.has(d.mood))
          .reduce((sum, d) => sum + d.count, 0),
      }))
      const grandTotal = groupTotals.reduce((sum, g) => sum + g.total, 0)
      for (const { name, total } of groupTotals) {
        row[name] = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
      }
      return row
    })
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Stemning over tid</p>
        <div className="flex overflow-hidden rounded-md border border-slate-700 text-xs">
          <button
            onClick={() => setMode('month')}
            className={`px-3 py-1 transition-colors ${mode === 'month' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Måned
          </button>
          <button
            onClick={() => setMode('year')}
            className={`px-3 py-1 transition-colors ${mode === 'year' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
          >
            År
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {SENTIMENT_GROUPS.map((group) => (
              <linearGradient key={group.name} id={`grad-${group.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={group.color} stopOpacity={0.9} />
                <stop offset="95%" stopColor={group.color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#334155', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
            itemStyle={{ color: '#cbd5e1' }}
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 12 }}
          />
          {SENTIMENT_GROUPS.map((group) => (
            <Area
              key={group.name}
              type="monotone"
              dataKey={group.name}
              stackId="1"
              stroke={group.color}
              strokeWidth={1}
              fill={`url(#grad-${group.name})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
