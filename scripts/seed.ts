import { db } from '../src/lib/db'

const defaults: [string, string][] = [
  ['ollama_url', 'http://host.docker.internal:11434'],
  ['ollama_model', 'qwen2.5vl:7b'],
  ['ai_provider', 'ollama'],
  ['anthropic_model', 'claude-opus-4-6'],
  ['confidence_threshold', '0.85'],
]

async function seed() {
  await Promise.all(
    defaults.map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: {}, create: { key, value } })
    )
  )

  // Fix ollama_url if it's set to localhost (invalid inside Docker)
  const ollamaUrl = await db.setting.findUnique({ where: { key: 'ollama_url' } })
  if (ollamaUrl?.value.includes('localhost')) {
    await db.setting.update({
      where: { key: 'ollama_url' },
      data: { value: 'http://host.docker.internal:11434' },
    })
    console.log('[seed] Fixed ollama_url: localhost → host.docker.internal')
  }

  await db.$disconnect()
  console.log('[seed] Default settings applied')
}

seed().catch((e) => { console.error('[seed] Failed:', e); process.exit(1) })
