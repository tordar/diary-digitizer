import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [moodByYear, entriesByYear, entriesByYearMonth, topPeople, topPlaces, topTopics, bookStats, bookMoods] = await Promise.all([
    db.$queryRaw<{ year: number; mood: string; count: bigint }[]>`
      SELECT
        EXTRACT(YEAR FROM e.date)::int AS year,
        unnest(m.mood) AS mood,
        COUNT(*)::bigint AS count
      FROM entries e
      JOIN entry_metadata m ON m.entry_id = e.id
      WHERE e.status = 'approved' AND e.date IS NOT NULL AND array_length(m.mood, 1) > 0
      GROUP BY year, mood
      ORDER BY year, mood
    `,
    db.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM date)::int AS year, COUNT(*)::bigint AS count
      FROM entries
      WHERE status = 'approved' AND date IS NOT NULL
      GROUP BY year
      ORDER BY year
    `,
    db.$queryRaw<{ year: number; month: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM date)::int AS year, EXTRACT(MONTH FROM date)::int AS month, COUNT(*)::bigint AS count
      FROM entries
      WHERE status = 'approved' AND date IS NOT NULL
      GROUP BY year, month
      ORDER BY year, month
    `,
    db.$queryRaw<{ person: string; count: bigint }[]>`
      SELECT unnest(people) AS person, COUNT(*) AS count
      FROM entry_metadata em
      JOIN entries e ON e.id = em.entry_id
      WHERE e.status = 'approved'
      GROUP BY person
      ORDER BY count DESC
      LIMIT 30
    `,
    db.$queryRaw<{ place: string; count: bigint }[]>`
      SELECT unnest(places) AS place, COUNT(*) AS count
      FROM entry_metadata em
      JOIN entries e ON e.id = em.entry_id
      WHERE e.status = 'approved'
      GROUP BY place
      ORDER BY count DESC
      LIMIT 30
    `,
    db.$queryRaw<{ topic: string; count: bigint }[]>`
      SELECT unnest(topics) AS topic, COUNT(*) AS count
      FROM entry_metadata em
      JOIN entries e ON e.id = em.entry_id
      WHERE e.status = 'approved'
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 50
    `,
    db.book.findMany({
      select: {
        id: true,
        name: true,
        dateRange: true,
        _count: { select: { entries: true } },
      },
    }),
    db.$queryRaw<{ book_id: string; mood: string; count: bigint }[]>`
      SELECT e.book_id, unnest(m.mood) AS mood, COUNT(*)::bigint AS count
      FROM entries e
      JOIN entry_metadata m ON m.entry_id = e.id
      WHERE e.status = 'approved' AND array_length(m.mood, 1) > 0
      GROUP BY e.book_id, mood
      ORDER BY e.book_id, count DESC
    `,
  ])

  return NextResponse.json({
    moodByYear: moodByYear.map((r) => ({ ...r, count: Number(r.count) })),
    entriesByYear: entriesByYear.map((r) => ({ year: r.year, count: Number(r.count) })),
    entriesByYearMonth: entriesByYearMonth.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) })),
    topPeople: topPeople.map((r) => ({ ...r, count: Number(r.count) })),
    topPlaces: topPlaces.map((r) => ({ ...r, count: Number(r.count) })),
    topTopics: topTopics.map((r) => ({ ...r, count: Number(r.count) })),
    bookStats,
    bookMoods: bookMoods.map((r) => ({ ...r, count: Number(r.count) })),
  })
}
