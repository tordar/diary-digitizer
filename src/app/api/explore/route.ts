import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [moodByYear, topPeople, topPlaces, topTopics, bookStats] = await Promise.all([
    db.$queryRaw<{ year: number; mood: string; count: bigint }[]>`
      SELECT
        EXTRACT(YEAR FROM e.date)::int AS year,
        m.mood,
        COUNT(*)::bigint AS count
      FROM entries e
      JOIN entry_metadata m ON m.entry_id = e.id
      WHERE e.status = 'approved' AND e.date IS NOT NULL AND m.mood IS NOT NULL
      GROUP BY year, m.mood
      ORDER BY year, m.mood
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
      include: { _count: { select: { entries: true } } },
    }),
  ])

  return NextResponse.json({
    moodByYear: moodByYear.map((r) => ({ ...r, count: Number(r.count) })),
    topPeople: topPeople.map((r) => ({ ...r, count: Number(r.count) })),
    topPlaces: topPlaces.map((r) => ({ ...r, count: Number(r.count) })),
    topTopics: topTopics.map((r) => ({ ...r, count: Number(r.count) })),
    bookStats,
  })
}
