import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ALLOWED_SETTINGS = ['ollama_url', 'ollama_model', 'confidence_threshold', 'prompt_template', 'default_language']

export async function GET() {
  const rows = await db.setting.findMany()
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_SETTINGS.includes(key)) continue
    await db.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  }
  const rows = await db.setting.findMany()
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
}
