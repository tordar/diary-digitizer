import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] }
  if (!ids || ids.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 entries' }, { status: 400 })
  }

  const entries = await db.entry.findMany({
    where: { id: { in: ids } },
    include: { pages: true, transcription: true, metadata: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  if (entries.length !== ids.length) {
    return NextResponse.json({ error: 'Some entries not found' }, { status: 404 })
  }

  const [primary, ...secondaries] = entries

  const allTexts = entries
    .map((e) => e.transcription?.correctedText ?? e.transcription?.rawText)
    .filter(Boolean) as string[]
  const combinedText = allTexts.join('\n\n---\n\n')

  const union = (arrs: string[][]) => [...new Set(arrs.flat())]
  const allMoods = union(entries.map((e) => e.metadata?.mood ?? []))
  const allTopics = union(entries.map((e) => e.metadata?.topics ?? []))
  const allPeople = union(entries.map((e) => e.metadata?.people ?? []))
  const allPlaces = union(entries.map((e) => e.metadata?.places ?? []))
  const allThemes = union(entries.map((e) => e.metadata?.themes ?? []))
  const bestConfidence = Math.max(...entries.map((e) => e.confidenceScore))

  await db.$transaction(async (tx) => {
    // Move pages from secondaries to primary
    await tx.page.updateMany({
      where: { entryId: { in: secondaries.map((e) => e.id) } },
      data: { entryId: primary.id },
    })

    // Re-index page order
    const allPages = await tx.page.findMany({
      where: { entryId: primary.id },
      orderBy: { pageOrder: 'asc' },
    })
    for (let i = 0; i < allPages.length; i++) {
      await tx.page.update({ where: { id: allPages[i].id }, data: { pageOrder: i } })
    }

    // Update transcription
    if (combinedText) {
      await tx.transcription.upsert({
        where: { entryId: primary.id },
        create: { entryId: primary.id, rawText: combinedText },
        update: { rawText: combinedText, correctedText: null },
      })
    }

    // Update metadata
    if (primary.metadata) {
      await tx.entryMetadata.update({
        where: { entryId: primary.id },
        data: { mood: allMoods, topics: allTopics, people: allPeople, places: allPlaces, themes: allThemes },
      })
    }

    // Update confidence
    await tx.entry.update({ where: { id: primary.id }, data: { confidenceScore: bestConfidence } })

    // Delete secondaries (cascades transcription + metadata)
    await tx.entry.deleteMany({ where: { id: { in: secondaries.map((e) => e.id) } } })
  })

  return NextResponse.json({ id: primary.id })
}
