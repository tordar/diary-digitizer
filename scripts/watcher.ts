import { config } from 'dotenv'
config({ path: '.env.local' })
config() // fallback to .env

import chokidar from 'chokidar'
import { join } from 'path'
import { enqueueFile } from '../src/lib/importer'
import { runWorkerLoop } from '../src/lib/worker'

const DATA_DIR = process.env.DATA_DIR ?? './data'
const INBOX_DIR = join(DATA_DIR, 'inbox')

async function main() {
  console.log(`[watcher] Watching ${INBOX_DIR}`)

  const watcher = chokidar.watch(INBOX_DIR, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
    ignored: /(^|[/\\])\../,
  })

  // Serialize enqueue calls to prevent race conditions on book find-or-create
  let enqueueQueue = Promise.resolve()

  watcher.on('add', (filePath) => {
    console.log(`[watcher] New file: ${filePath}`)
    enqueueQueue = enqueueQueue.then(async () => {
      try {
        await enqueueFile(filePath, INBOX_DIR)
      } catch (err) {
        console.error(`[watcher] Failed to enqueue ${filePath}:`, err)
      }
    })
  })

  watcher.on('error', (err) => {
    console.error('[watcher] Error:', err)
  })

  // Start job worker loop
  await runWorkerLoop(3000)
}

main().catch(console.error)
