import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { action } = await req.json()
  if (action !== 'approve') {
    return NextResponse.json({ error: 'action must be approve' }, { status: 400 })
  }
  try {
    const entry = await db.entry.update({
      where: { id },
      data: { status: 'approved' },
    })
    return NextResponse.json(entry)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
