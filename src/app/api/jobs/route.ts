import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [queued, processing, failed] = await Promise.all([
    db.processingJob.count({ where: { status: 'queued' } }),
    db.processingJob.count({ where: { status: 'processing' } }),
    db.processingJob.count({ where: { status: 'failed' } }),
  ])

  const recentFailed = await db.processingJob.findMany({
    where: { status: 'failed' },
    take: 10,
    orderBy: { completedAt: 'desc' },
    include: { page: { select: { filePath: true } } },
  })

  return NextResponse.json({ queued, processing, failed, recentFailed })
}

export async function POST() {
  await db.processingJob.updateMany({
    where: { status: 'failed' },
    data: { status: 'queued', attempts: 0, error: null },
  })
  return NextResponse.json({ ok: true })
}
