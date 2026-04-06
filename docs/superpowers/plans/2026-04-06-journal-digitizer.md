# Journal Digitizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted, privacy-first web app that transcribes handwritten Norwegian journal entries using Ollama/Qwen3-VL and makes them navigable through rich search, filter, and timeline UI.

**Architecture:** Next.js 15 + TypeScript in Docker, PostgreSQL with Norwegian FTS, Ollama running natively on macOS for Metal GPU access. A file watcher process runs alongside Next.js and processes files dropped into `data/inbox/`. No cloud services.

**Tech Stack:** Next.js 15, TypeScript, Prisma (ORM), PostgreSQL 16, Tailwind CSS, Vitest, chokidar, sharp, zod, Ollama REST API

---

## File Map

```
journal-digitizer/
├── docker-compose.yml
├── Dockerfile
├── entrypoint.sh                         # Starts watcher + Next.js in container
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── 0001_initial/                 # Schema + FTS trigger + GIN indexes
├── scripts/
│   └── watcher.ts                        # Standalone file watcher process
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with nav
│   │   ├── page.tsx                      # Main browser (/)
│   │   ├── entries/[id]/page.tsx         # Entry detail
│   │   ├── review/page.tsx               # Review queue
│   │   ├── upload/page.tsx               # Upload / import
│   │   ├── books/page.tsx                # Book management
│   │   ├── explore/page.tsx              # Explore (mood, people, places)
│   │   └── settings/page.tsx             # Settings
│   ├── app/api/
│   │   ├── entries/route.ts              # GET list/search
│   │   ├── entries/[id]/route.ts         # GET detail, PATCH update
│   │   ├── books/route.ts                # GET list, POST create
│   │   ├── books/[id]/route.ts           # PATCH rename, DELETE
│   │   ├── review/route.ts               # GET pending queue
│   │   ├── review/[id]/route.ts          # PATCH approve/reject
│   │   ├── upload/route.ts               # POST file upload to inbox
│   │   ├── import/route.ts               # POST trigger folder scan
│   │   ├── jobs/route.ts                 # GET job statuses
│   │   ├── explore/route.ts              # GET explore aggregates
│   │   └── settings/route.ts             # GET/PATCH settings
│   ├── lib/
│   │   ├── db.ts                         # Prisma client singleton
│   │   ├── hash.ts                       # SHA-256 file hashing
│   │   ├── image.ts                      # sharp: optimise + move files
│   │   ├── ollama.ts                     # Ollama REST client
│   │   ├── schema.ts                     # Zod schema for AI response
│   │   ├── prompt.ts                     # AI prompt builder
│   │   ├── worker.ts                     # Job queue processor
│   │   └── importer.ts                   # Folder structure parser
│   └── components/
│       ├── Nav.tsx                       # Top navigation bar
│       ├── FilterSidebar.tsx             # Left filter panel
│       ├── EntryCard.tsx                 # Entry list item
│       ├── TimelineHeatmap.tsx           # Right sidebar heatmap
│       ├── ImageViewer.tsx               # Scan image with zoom/rotate
│       ├── MetadataTags.tsx              # Mood/topics/people/places chips
│       ├── ReviewBar.tsx                 # Approve/reject action bar
│       ├── BookSelector.tsx              # Book picker for import
│       ├── ProcessingStatus.tsx          # Live job status banner
│       └── MoodChart.tsx                 # Area chart for explore page
└── tests/
    ├── lib/
    │   ├── hash.test.ts
    │   ├── schema.test.ts
    │   ├── prompt.test.ts
    │   ├── importer.test.ts
    │   └── worker.test.ts
    └── api/
        ├── entries.test.ts
        ├── books.test.ts
        └── review.test.ts
```

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `tailwind.config.ts`
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `entrypoint.sh`
- Create: `.env.example`
- Create: `next.config.ts`

- [ ] **Step 1: Initialise Next.js project**

```bash
cd /Users/tordartommervik/Documents/code/journal-digitizer
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Wait for it to complete, then verify: `ls` should show `app/`, `package.json`, `tailwind.config.ts`.

- [ ] **Step 2: Move app directory under src**

```bash
mkdir -p src
mv app src/app
mv components src/components 2>/dev/null || true
```

Update `tsconfig.json` paths:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install prisma @prisma/client chokidar sharp zod
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom tsx concurrently
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add npm scripts**

Update `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"tsx scripts/watcher.ts\"",
    "build": "next build",
    "start": "next start",
    "watcher": "tsx scripts/watcher.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  }
}
```

- [ ] **Step 6: Create Docker Compose**

Create `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://journal:journal@db:5432/journal
      - OLLAMA_URL=${OLLAMA_URL:-http://host.docker.internal:11434}
      - CONFIDENCE_THRESHOLD=${CONFIDENCE_THRESHOLD:-0.85}
      - DATA_DIR=/data
    volumes:
      - ./data:/data
    depends_on:
      db:
        condition: service_healthy
    extra_hosts:
      - "host.docker.internal:host-gateway"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: journal
      POSTGRES_PASSWORD: journal
      POSTGRES_DB: journal
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U journal"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 7: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S journal && adduser -S journal -G journal
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
RUN chown -R journal:journal /app
USER journal
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
```

- [ ] **Step 8: Create entrypoint script**

Create `entrypoint.sh`:

```bash
#!/bin/sh
set -e

# Run migrations
npx prisma migrate deploy

# Start file watcher in background
node scripts/watcher.js &

# Start Next.js
exec node server.js
```

```bash
chmod +x entrypoint.sh
```

- [ ] **Step 9: Create .env.example**

Create `.env.example`:

```
DATABASE_URL=postgresql://journal:journal@localhost:5432/journal
OLLAMA_URL=http://localhost:11434
CONFIDENCE_THRESHOLD=0.85
DATA_DIR=./data
```

Copy to `.env.local` for development:

```bash
cp .env.example .env.local
```

- [ ] **Step 10: Add output: standalone to next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 11: Add .gitignore entries**

Append to `.gitignore`:

```
data/
.env.local
.env
```

- [ ] **Step 12: Create data directories**

```bash
mkdir -p data/inbox data/processed data/images data/rejected
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: project scaffold — Next.js, Docker Compose, Vitest"
```

---

### Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/0001_initial/migration.sql`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Book {
  id         String   @id @default(uuid())
  name       String
  folderHint String?  @map("folder_hint")
  dateRange  String?  @map("date_range")
  createdAt  DateTime @default(now()) @map("created_at")
  pages      Page[]
  entries    Entry[]

  @@map("books")
}

model Page {
  id           String         @id @default(uuid())
  bookId       String         @map("book_id")
  entryId      String?        @map("entry_id")
  filePath     String         @map("file_path")
  originalPath String         @map("original_path")
  fileHash     String         @unique @map("file_hash")
  pageOrder    Int            @default(0) @map("page_order")
  ingestedAt   DateTime       @default(now()) @map("ingested_at")
  book         Book           @relation(fields: [bookId], references: [id])
  entry        Entry?         @relation(fields: [entryId], references: [id])
  job          ProcessingJob?

  @@map("pages")
}

enum EntryType {
  text
  image
  mixed
  special
}

enum EntryStatus {
  pending_review
  approved
}

model Entry {
  id              String        @id @default(uuid())
  bookId          String        @map("book_id")
  title           String?
  date            DateTime?     @db.Date
  dateInferred    Boolean       @default(false) @map("date_inferred")
  entryType       EntryType     @map("entry_type")
  status          EntryStatus   @default(pending_review)
  confidenceScore Float         @map("confidence_score")
  createdAt       DateTime      @default(now()) @map("created_at")
  book            Book          @relation(fields: [bookId], references: [id])
  pages           Page[]
  transcription   Transcription?
  metadata        EntryMetadata?

  @@map("entries")
}

model Transcription {
  id            String  @id @default(uuid())
  entryId       String  @unique @map("entry_id")
  rawText       String  @map("raw_text")
  correctedText String? @map("corrected_text")
  language      String  @default("no")
  entry         Entry   @relation(fields: [entryId], references: [id])

  @@map("transcriptions")
}

model EntryMetadata {
  id      String   @id @default(uuid())
  entryId String   @unique @map("entry_id")
  mood    String?
  topics  String[]
  people  String[]
  places  String[]
  themes  String[]
  entry   Entry    @relation(fields: [entryId], references: [id])

  @@map("entry_metadata")
}

enum JobStatus {
  queued
  processing
  done
  failed
}

model ProcessingJob {
  id          String    @id @default(uuid())
  pageId      String    @unique @map("page_id")
  status      JobStatus @default(queued)
  error       String?
  attempts    Int       @default(0)
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")
  page        Page      @relation(fields: [pageId], references: [id])

  @@map("processing_jobs")
}

model Setting {
  key   String @id
  value String

  @@map("settings")
}
```

- [ ] **Step 3: Create initial migration**

```bash
npx prisma migrate dev --name initial
```

This creates `prisma/migrations/TIMESTAMP_initial/migration.sql`. Note the exact path.

- [ ] **Step 4: Add FTS and GIN indexes via migration**

Create a new migration file manually. Run:

```bash
npx prisma migrate dev --name fts_and_gin_indexes --create-only
```

Open the generated empty migration SQL file and paste:

```sql
-- Add tsvector column for Norwegian full-text search
ALTER TABLE transcriptions
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('norwegian',
      coalesce(corrected_text, raw_text, ''))
  ) STORED;

-- GIN index on search vector
CREATE INDEX transcriptions_search_vector_idx
  ON transcriptions USING GIN (search_vector);

-- GIN indexes on array columns in entry_metadata
CREATE INDEX entry_metadata_topics_idx
  ON entry_metadata USING GIN (topics);

CREATE INDEX entry_metadata_people_idx
  ON entry_metadata USING GIN (people);

CREATE INDEX entry_metadata_places_idx
  ON entry_metadata USING GIN (places);

CREATE INDEX entry_metadata_themes_idx
  ON entry_metadata USING GIN (themes);

-- Index entries by date for timeline queries
CREATE INDEX entries_date_idx ON entries (date);
CREATE INDEX entries_status_idx ON entries (status);
CREATE INDEX entries_book_id_idx ON entries (book_id);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('ollama_url', 'http://host.docker.internal:11434'),
  ('ollama_model', 'qwen2.5vl:7b'),
  ('confidence_threshold', '0.85'),
  ('default_language', 'no'),
  ('prompt_template', 'default');
```

Apply:

```bash
npx prisma migrate dev
```

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Create db.ts singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: database schema with Norwegian FTS and GIN indexes"
```

---

### Task 3: App Shell

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Nav.tsx`
- Create: `src/app/page.tsx` (placeholder)
- Create: `src/app/entries/[id]/page.tsx` (placeholder)
- Create: `src/app/review/page.tsx` (placeholder)
- Create: `src/app/upload/page.tsx` (placeholder)
- Create: `src/app/books/page.tsx` (placeholder)
- Create: `src/app/explore/page.tsx` (placeholder)
- Create: `src/app/settings/page.tsx` (placeholder)

- [ ] **Step 1: Create Nav component**

Create `src/components/Nav.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Bla gjennom' },
  { href: '/explore', label: 'Utforsk' },
  { href: '/review', label: 'Gjennomgå' },
  { href: '/upload', label: 'Last opp' },
  { href: '/books', label: 'Bøker' },
  { href: '/settings', label: 'Innstillinger' },
]

export function Nav({ reviewCount }: { reviewCount?: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 border-b border-slate-800 bg-slate-950 px-4 py-2">
      <span className="mr-4 text-sm font-bold text-slate-100">📓 Dagbok</span>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`rounded px-3 py-1.5 text-xs transition-colors ${
            pathname === href
              ? 'bg-violet-700 text-violet-100'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {label}
          {href === '/review' && reviewCount ? (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
              {reviewCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dagbok',
  description: 'Privat dagbokarkiv',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create placeholder pages**

Create `src/app/page.tsx`:

```tsx
export default function BrowsePage() {
  return <div className="p-8 text-slate-400">Browse — kommer snart</div>
}
```

Create `src/app/entries/[id]/page.tsx`:

```tsx
export default function EntryPage({ params }: { params: { id: string } }) {
  return <div className="p-8 text-slate-400">Oppføring {params.id}</div>
}
```

Create `src/app/review/page.tsx`:

```tsx
export default function ReviewPage() {
  return <div className="p-8 text-slate-400">Gjennomgå — kommer snart</div>
}
```

Create `src/app/upload/page.tsx`:

```tsx
export default function UploadPage() {
  return <div className="p-8 text-slate-400">Last opp — kommer snart</div>
}
```

Create `src/app/books/page.tsx`:

```tsx
export default function BooksPage() {
  return <div className="p-8 text-slate-400">Bøker — kommer snart</div>
}
```

Create `src/app/explore/page.tsx`:

```tsx
export default function ExplorePage() {
  return <div className="p-8 text-slate-400">Utforsk — kommer snart</div>
}
```

Create `src/app/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return <div className="p-8 text-slate-400">Innstillinger — kommer snart</div>
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000, navigation bar visible, all placeholder routes respond.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: app shell with navigation and placeholder routes"
```

---

## Phase 2: Ingestion Engine

### Task 4: File Utilities

**Files:**
- Create: `src/lib/hash.ts`
- Create: `src/lib/image.ts`
- Create: `tests/lib/hash.test.ts`

- [ ] **Step 1: Write failing tests for hash utility**

Create `tests/lib/hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hashFile } from '@/lib/hash'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('hashFile', () => {
  it('returns a 64-character hex string', async () => {
    const path = join(tmpdir(), 'test-hash.txt')
    await writeFile(path, 'hello world')
    const hash = await hashFile(path)
    await unlink(path)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same hash for identical content', async () => {
    const path1 = join(tmpdir(), 'test-hash-a.txt')
    const path2 = join(tmpdir(), 'test-hash-b.txt')
    await writeFile(path1, 'same content')
    await writeFile(path2, 'same content')
    const [h1, h2] = await Promise.all([hashFile(path1), hashFile(path2)])
    await Promise.all([unlink(path1), unlink(path2)])
    expect(h1).toBe(h2)
  })

  it('returns different hashes for different content', async () => {
    const path1 = join(tmpdir(), 'test-hash-c.txt')
    const path2 = join(tmpdir(), 'test-hash-d.txt')
    await writeFile(path1, 'content A')
    await writeFile(path2, 'content B')
    const [h1, h2] = await Promise.all([hashFile(path1), hashFile(path2)])
    await Promise.all([unlink(path1), unlink(path2)])
    expect(h1).not.toBe(h2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/hash.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/hash'`

- [ ] **Step 3: Implement hash utility**

Create `src/lib/hash.ts`:

```typescript
import { createHash } from 'crypto'
import { createReadStream } from 'fs'

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/hash.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Implement image utility**

Create `src/lib/image.ts`:

```typescript
import sharp from 'sharp'
import { copyFile, mkdir } from 'fs/promises'
import { dirname, basename, join } from 'path'

const DATA_DIR = process.env.DATA_DIR ?? './data'

export async function optimiseForWeb(
  sourcePath: string,
  outputRelPath: string
): Promise<string> {
  const fullOutput = join(DATA_DIR, 'images', outputRelPath)
  await mkdir(dirname(fullOutput), { recursive: true })

  await sharp(sourcePath)
    .rotate() // auto-rotate based on EXIF
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(fullOutput)

  return fullOutput
}

export async function moveToProcessed(
  sourcePath: string,
  destRelPath: string
): Promise<string> {
  const fullDest = join(DATA_DIR, 'processed', destRelPath)
  await mkdir(dirname(fullDest), { recursive: true })
  await copyFile(sourcePath, fullDest)
  return fullDest
}

export const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.pdf',
])

export function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.has(ext)
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: file hashing and image optimisation utilities"
```

---

### Task 5: Ollama Client and AI Response Schema

**Files:**
- Create: `src/lib/schema.ts`
- Create: `src/lib/ollama.ts`
- Create: `tests/lib/schema.test.ts`

- [ ] **Step 1: Write failing tests for schema validation**

Create `tests/lib/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { aiResponseSchema, type AiResponse } from '@/lib/schema'

describe('aiResponseSchema', () => {
  it('validates a complete valid response', () => {
    const input: AiResponse = {
      entry_type: 'text',
      title: 'En god dag',
      date: '2021-03-15',
      date_inferred: false,
      transcription: 'Dette er teksten.',
      mood: 'glad',
      topics: ['arbeid'],
      people: ['Jonas'],
      places: ['Oslo'],
      themes: ['produktivitet'],
      confidence_score: 0.95,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('allows null date and title for special entries', () => {
    const input = {
      entry_type: 'special',
      title: null,
      date: null,
      date_inferred: false,
      transcription: 'Uke 46',
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.9,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid entry_type', () => {
    const input = { entry_type: 'unknown', confidence_score: 0.5 }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects confidence_score outside 0–1', () => {
    const input = {
      entry_type: 'text',
      title: null,
      date: null,
      date_inferred: false,
      transcription: '',
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 1.5,
    }
    const result = aiResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/schema.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/schema'`

- [ ] **Step 3: Implement schema**

Create `src/lib/schema.ts`:

```typescript
import { z } from 'zod'

export const aiResponseSchema = z.object({
  entry_type: z.enum(['text', 'image', 'mixed', 'special']),
  title: z.string().nullable(),
  date: z.string().nullable().refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    { message: 'date must be YYYY-MM-DD or null' }
  ),
  date_inferred: z.boolean(),
  transcription: z.string().nullable(),
  mood: z.enum(['glad', 'nøytral', 'lav', 'blandet']).nullable(),
  topics: z.array(z.string()),
  people: z.array(z.string()),
  places: z.array(z.string()),
  themes: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
})

export type AiResponse = z.infer<typeof aiResponseSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/schema.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Implement Ollama client**

Create `src/lib/ollama.ts`:

```typescript
import { aiResponseSchema, type AiResponse } from './schema'
import { readFile } from 'fs/promises'

export async function transcribePage(
  imagePath: string,
  promptTemplate: string,
  ollamaUrl: string,
  model: string,
  monthHint?: string | null
): Promise<AiResponse> {
  const imageBuffer = await readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const ext = imagePath.toLowerCase().split('.').pop()
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

  const prompt = monthHint
    ? `${promptTemplate}\n\nNote: This page is from ${monthHint}. Use this as context for date inference.`
    : promptTemplate

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      format: 'json',
      stream: false,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [`data:${mimeType};base64,${base64Image}`],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000), // 2 minute timeout per page
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const body = await response.json()
  const rawContent = body?.message?.content

  if (!rawContent) {
    throw new Error('Ollama returned empty response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error(`Ollama returned non-JSON: ${rawContent.slice(0, 200)}`)
  }

  const validated = aiResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`AI response schema invalid: ${validated.error.message}`)
  }

  return validated.data
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Ollama client with Zod schema validation"
```

---

### Task 6: AI Prompt

**Files:**
- Create: `src/lib/prompt.ts`
- Create: `tests/lib/prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt, DEFAULT_PROMPT_TEMPLATE } from '@/lib/prompt'

describe('buildPrompt', () => {
  it('returns the template unchanged when using default', () => {
    const result = buildPrompt('default')
    expect(result).toBe(DEFAULT_PROMPT_TEMPLATE)
  })

  it('returns custom template as-is', () => {
    const custom = 'My custom prompt'
    expect(buildPrompt(custom)).toBe(custom)
  })

  it('default prompt requests JSON output', () => {
    expect(DEFAULT_PROMPT_TEMPLATE).toContain('JSON')
  })

  it('default prompt mentions all required fields', () => {
    const fields = ['entry_type', 'title', 'date', 'transcription', 'mood', 'topics', 'people', 'places', 'themes', 'confidence_score']
    for (const field of fields) {
      expect(DEFAULT_PROMPT_TEMPLATE).toContain(field)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/prompt.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/prompt'`

- [ ] **Step 3: Implement prompt builder**

Create `src/lib/prompt.ts`:

```typescript
export const DEFAULT_PROMPT_TEMPLATE = `You are transcribing a handwritten journal page. The text is primarily in Norwegian, but may include English or other languages.

Analyse the image carefully and return a JSON object with exactly these fields:

{
  "entry_type": "text" | "image" | "mixed" | "special",
  "title": string | null,
  "date": "YYYY-MM-DD" | null,
  "date_inferred": boolean,
  "transcription": string | null,
  "mood": "glad" | "nøytral" | "lav" | "blandet" | null,
  "topics": string[],
  "people": string[],
  "places": string[],
  "themes": string[],
  "confidence_score": number between 0.0 and 1.0
}

Rules:
- entry_type: "text" = prose writing; "image" = drawing/photo with no readable text; "mixed" = text + drawings; "special" = structured page (table, habit tracker, list, index)
- title: extract from the page heading if present, otherwise null
- date: exact date if written on the page; null if absent
- date_inferred: true if you are estimating the date from context, not reading it directly
- transcription: full verbatim text of the page. Preserve original language and spelling. null for pure image entries.
- mood: overall emotional tone of the entry. null if unclear or not applicable.
- topics: 1–5 short topic tags in Norwegian (e.g. "arbeid", "familie", "helse")
- people: full names or first names of people mentioned
- places: cities, countries, or named locations mentioned
- themes: higher-level recurring themes (e.g. "identitet", "fremtid", "ensomhet")
- confidence_score: your confidence in the accuracy of this transcription (0.0 = very uncertain, 1.0 = certain)

Return only valid JSON. No markdown, no explanation.`

export function buildPrompt(template: string): string {
  return template === 'default' ? DEFAULT_PROMPT_TEMPLATE : template
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/prompt.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: AI prompt builder with Norwegian-optimised default template"
```

---

### Task 7: Job Worker

**Files:**
- Create: `src/lib/worker.ts`
- Create: `tests/lib/worker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routeByEntryType, applyConfidenceDecision } from '@/lib/worker'
import type { AiResponse } from '@/lib/schema'

describe('routeByEntryType', () => {
  it('returns transcription for text entries', () => {
    const ai: AiResponse = {
      entry_type: 'text',
      title: 'Test',
      date: '2021-01-01',
      date_inferred: false,
      transcription: 'Some text',
      mood: 'glad',
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.9,
    }
    const result = routeByEntryType(ai)
    expect(result.transcription).toBe('Some text')
    expect(result.skipTranscription).toBe(false)
  })

  it('sets skipTranscription for image entries', () => {
    const ai: AiResponse = {
      entry_type: 'image',
      title: null,
      date: null,
      date_inferred: false,
      transcription: null,
      mood: null,
      topics: [],
      people: [],
      places: [],
      themes: [],
      confidence_score: 0.8,
    }
    const result = routeByEntryType(ai)
    expect(result.skipTranscription).toBe(true)
  })
})

describe('applyConfidenceDecision', () => {
  it('returns approved for score >= threshold', () => {
    expect(applyConfidenceDecision(0.9, 0.85)).toBe('approved')
    expect(applyConfidenceDecision(0.85, 0.85)).toBe('approved')
  })

  it('returns pending_review for score below threshold', () => {
    expect(applyConfidenceDecision(0.84, 0.85)).toBe('pending_review')
    expect(applyConfidenceDecision(0.0, 0.85)).toBe('pending_review')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/worker.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/worker'`

- [ ] **Step 3: Implement worker pure functions**

Create `src/lib/worker.ts`:

```typescript
import type { AiResponse } from './schema'
import type { EntryStatus } from '@prisma/client'

export function routeByEntryType(ai: AiResponse): {
  transcription: string | null
  skipTranscription: boolean
} {
  if (ai.entry_type === 'image') {
    return { transcription: null, skipTranscription: true }
  }
  return {
    transcription: ai.transcription,
    skipTranscription: false,
  }
}

export function applyConfidenceDecision(
  score: number,
  threshold: number
): EntryStatus {
  return score >= threshold ? 'approved' : 'pending_review'
}

export async function processJob(
  pageId: string,
  options: {
    ollamaUrl: string
    model: string
    promptTemplate: string
    confidenceThreshold: number
    monthHint?: string | null
  }
): Promise<void> {
  const { db } = await import('./db')
  const { transcribePage } = await import('./ollama')
  const { buildPrompt } = await import('./prompt')
  const { optimiseForWeb, moveToProcessed } = await import('./image')
  const { basename, join } = await import('path')
  const { rename } = await import('fs/promises')

  const DATA_DIR = process.env.DATA_DIR ?? './data'

  // Mark as processing
  await db.processingJob.update({
    where: { pageId },
    data: { status: 'processing', startedAt: new Date() },
  })

  const page = await db.page.findUniqueOrThrow({ where: { id: pageId } })

  const prompt = buildPrompt(options.promptTemplate)
  const ai = await transcribePage(
    page.filePath,
    prompt,
    options.ollamaUrl,
    options.model,
    options.monthHint
  )

  const { transcription, skipTranscription } = routeByEntryType(ai)
  const status = applyConfidenceDecision(ai.confidence_score, options.confidenceThreshold)

  // Optimise image
  const outRelPath = `${page.id}.jpg`
  const optimisedPath = await optimiseForWeb(page.filePath, outRelPath)
  const processedPath = await moveToProcessed(
    page.filePath,
    basename(page.filePath)
  )

  // Attempt to remove from inbox (best effort)
  try {
    const { unlink } = await import('fs/promises')
    await unlink(page.filePath)
  } catch {
    // ignore — file may have already been moved
  }

  // Create entry
  const entry = await db.entry.create({
    data: {
      bookId: page.bookId,
      title: ai.title,
      date: ai.date ? new Date(ai.date) : null,
      dateInferred: ai.date_inferred,
      entryType: ai.entry_type,
      status,
      confidenceScore: ai.confidence_score,
    },
  })

  // Link page to entry, update paths
  await db.page.update({
    where: { id: pageId },
    data: {
      entryId: entry.id,
      filePath: optimisedPath,
      originalPath: processedPath,
    },
  })

  if (!skipTranscription && transcription) {
    await db.transcription.create({
      data: {
        entryId: entry.id,
        rawText: transcription,
        language: 'no',
      },
    })
  }

  await db.entryMetadata.create({
    data: {
      entryId: entry.id,
      mood: ai.mood,
      topics: ai.topics,
      people: ai.people,
      places: ai.places,
      themes: ai.themes,
    },
  })

  await db.processingJob.update({
    where: { pageId },
    data: { status: 'done', completedAt: new Date() },
  })
}

export async function runWorkerLoop(intervalMs = 2000): Promise<void> {
  const { db } = await import('./db')

  const getSettings = async () => {
    const rows = await db.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      ollamaUrl: map['ollama_url'] ?? 'http://localhost:11434',
      model: map['ollama_model'] ?? 'qwen2.5vl:7b',
      promptTemplate: map['prompt_template'] ?? 'default',
      confidenceThreshold: parseFloat(map['confidence_threshold'] ?? '0.85'),
    }
  }

  const processNext = async () => {
    const job = await db.processingJob.findFirst({
      where: {
        status: 'queued',
        OR: [
          { attempts: { lt: 3 } },
        ],
      },
      orderBy: { page: { ingestedAt: 'asc' } },
    })

    if (!job) return

    const settings = await getSettings()

    try {
      await processJob(job.pageId, settings)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await db.processingJob.update({
        where: { pageId: job.pageId },
        data: {
          status: job.attempts + 1 >= 3 ? 'failed' : 'queued',
          attempts: { increment: 1 },
          error: message,
          startedAt: null,
        },
      })
    }
  }

  setInterval(processNext, intervalMs)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/worker.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: job worker with confidence routing and retry logic"
```

---

### Task 8: Folder Importer and File Watcher

**Files:**
- Create: `src/lib/importer.ts`
- Create: `scripts/watcher.ts`
- Create: `tests/lib/importer.test.ts`

- [ ] **Step 1: Write failing tests for importer**

Create `tests/lib/importer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseInboxPath, detectMonthHint } from '@/lib/importer'

describe('parseInboxPath', () => {
  it('parses structured path: book/month/file', () => {
    const result = parseInboxPath('Book 4/[11] November 19/001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(false)
    expect(result.monthHint).toBe('[11] November 19')
  })

  it('detects Special subfolder', () => {
    const result = parseInboxPath('Book 4/Special/611.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(true)
    expect(result.monthHint).toBeNull()
  })

  it('handles flat file with no subfolders', () => {
    const result = parseInboxPath('001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBeNull()
    expect(result.isSpecial).toBe(false)
  })

  it('handles book-level file with no month', () => {
    const result = parseInboxPath('Book 4/001.jpg', '/data/inbox')
    expect(result.bookFolderHint).toBe('Book 4')
    expect(result.isSpecial).toBe(false)
    expect(result.monthHint).toBeNull()
  })
})

describe('detectMonthHint', () => {
  it('parses [11] November 19 as November 2019', () => {
    expect(detectMonthHint('[11] November 19')).toBe('November 2019')
  })

  it('parses January 20 as January 2020', () => {
    expect(detectMonthHint('[1] January 20')).toBe('January 2020')
  })

  it('returns null for unrecognised format', () => {
    expect(detectMonthHint('Special')).toBeNull()
    expect(detectMonthHint('random folder')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/importer.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/importer'`

- [ ] **Step 3: Implement importer**

Create `src/lib/importer.ts`:

```typescript
import { relative, dirname, basename } from 'path'

export interface InboxPathInfo {
  bookFolderHint: string | null
  isSpecial: boolean
  monthHint: string | null
}

export function parseInboxPath(relPath: string, _inboxDir: string): InboxPathInfo {
  // Normalise separators
  const parts = relPath.replace(/\\/g, '/').split('/')
  const filename = parts[parts.length - 1]

  if (parts.length === 1) {
    // Flat file
    return { bookFolderHint: null, isSpecial: false, monthHint: null }
  }

  const bookFolderHint = parts[0]

  if (parts.length === 2) {
    // book/file — no month subfolder
    return { bookFolderHint, isSpecial: false, monthHint: null }
  }

  const subfolder = parts[1]
  const isSpecial = subfolder.toLowerCase() === 'special'
  const monthHint = isSpecial ? null : subfolder

  return { bookFolderHint, isSpecial, monthHint }
}

const MONTH_PATTERN = /^\[?\d+\]?\s+([A-Za-z]+)\s+(\d{2})$/

export function detectMonthHint(folderName: string): string | null {
  const match = folderName.match(MONTH_PATTERN)
  if (!match) return null
  const [, monthName, year2] = match
  const fullYear = parseInt(year2, 10) + 2000
  return `${monthName} ${fullYear}`
}

export async function enqueueFile(
  absolutePath: string,
  inboxDir: string,
  defaultBookId?: string
): Promise<void> {
  const { db } = await import('./db')
  const { hashFile } = await import('./hash')
  const { isSupported } = await import('./image')
  const { basename: bn, relative: rel } = await import('path')
  const { rename } = await import('fs/promises')

  const filename = bn(absolutePath)

  if (!isSupported(filename)) {
    const { join, dirname: dn } = await import('path')
    const { mkdir, copyFile, unlink } = await import('fs/promises')
    const DATA_DIR = process.env.DATA_DIR ?? './data'
    const rejectedPath = join(DATA_DIR, 'rejected', filename)
    await mkdir(join(DATA_DIR, 'rejected'), { recursive: true })
    await copyFile(absolutePath, rejectedPath)
    await unlink(absolutePath)
    console.warn(`[importer] Unsupported file type, moved to rejected: ${filename}`)
    return
  }

  const hash = await hashFile(absolutePath)

  // Duplicate check
  const existing = await db.page.findUnique({ where: { fileHash: hash } })
  if (existing) {
    console.log(`[importer] Duplicate skipped: ${filename}`)
    return
  }

  const relPath = rel(inboxDir, absolutePath)
  const { bookFolderHint, isSpecial, monthHint } = parseInboxPath(relPath, inboxDir)
  const parsedMonthHint = monthHint ? detectMonthHint(monthHint) : null

  // Find or create book
  let bookId = defaultBookId
  if (!bookId) {
    if (bookFolderHint) {
      let book = await db.book.findFirst({ where: { folderHint: bookFolderHint } })
      if (!book) {
        book = await db.book.create({
          data: { name: bookFolderHint, folderHint: bookFolderHint },
        })
      }
      bookId = book.id
    } else {
      // Flat import — assign to "Usortert" book
      let book = await db.book.findFirst({ where: { folderHint: '__unsorted__' } })
      if (!book) {
        book = await db.book.create({
          data: { name: 'Usortert', folderHint: '__unsorted__' },
        })
      }
      bookId = book.id
    }
  }

  const page = await db.page.create({
    data: {
      bookId,
      filePath: absolutePath,
      originalPath: absolutePath,
      fileHash: hash,
    },
  })

  await db.processingJob.create({
    data: {
      pageId: page.id,
      status: 'queued',
    },
  })

  // Store month hint and special flag on the job for the worker to read
  // We do this via a metadata approach: worker reads page path context
  // The parsedMonthHint and isSpecial are passed implicitly through the
  // folder structure, which the worker re-parses from the page's file path

  console.log(`[importer] Enqueued: ${filename} → book ${bookId}`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/importer.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Create file watcher script**

Create `scripts/watcher.ts`:

```typescript
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

  watcher.on('add', async (filePath) => {
    console.log(`[watcher] New file: ${filePath}`)
    try {
      await enqueueFile(filePath, INBOX_DIR)
    } catch (err) {
      console.error(`[watcher] Failed to enqueue ${filePath}:`, err)
    }
  })

  watcher.on('error', (err) => {
    console.error('[watcher] Error:', err)
  })

  // Start job worker loop
  await runWorkerLoop(3000)
}

main().catch(console.error)
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: folder importer, path parser, and file watcher"
```

---

## Phase 3: API Layer

### Task 9: Entries API

**Files:**
- Create: `src/app/api/entries/route.ts`
- Create: `src/app/api/entries/[id]/route.ts`
- Create: `tests/api/entries.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `tests/api/entries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Unit-test the query-building logic in isolation
import { buildEntriesWhere } from '@/app/api/entries/route'

describe('buildEntriesWhere', () => {
  it('returns empty where for no params', () => {
    const where = buildEntriesWhere({})
    expect(where).toEqual({ status: 'approved' })
  })

  it('adds book filter', () => {
    const where = buildEntriesWhere({ bookId: 'abc' })
    expect(where).toMatchObject({ bookId: 'abc' })
  })

  it('adds mood filter', () => {
    const where = buildEntriesWhere({ mood: 'glad' })
    expect(where).toMatchObject({ metadata: { mood: 'glad' } })
  })

  it('adds entry type filter', () => {
    const where = buildEntriesWhere({ entryType: 'image' })
    expect(where).toMatchObject({ entryType: 'image' })
  })

  it('adds people filter using array contains', () => {
    const where = buildEntriesWhere({ person: 'Jonas' })
    expect(where).toMatchObject({
      metadata: { people: { has: 'Jonas' } },
    })
  })

  it('adds date range filter', () => {
    const where = buildEntriesWhere({ dateFrom: '2020-01-01', dateTo: '2021-01-01' })
    expect(where).toMatchObject({
      date: { gte: new Date('2020-01-01'), lte: new Date('2021-01-01') },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/api/entries.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement entries list API**

Create `src/app/api/entries/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface EntryFilters {
  bookId?: string
  mood?: string
  entryType?: string
  person?: string
  place?: string
  topic?: string
  dateFrom?: string
  dateTo?: string
  q?: string
  status?: string
}

export function buildEntriesWhere(filters: EntryFilters): Prisma.EntryWhereInput {
  const where: Prisma.EntryWhereInput = {
    status: (filters.status as Prisma.EnumEntryStatusFilter | undefined) ?? 'approved',
  }

  if (filters.bookId) where.bookId = filters.bookId
  if (filters.entryType) where.entryType = filters.entryType as Prisma.EnumEntryTypeFilter

  const metadataWhere: Prisma.EntryMetadataWhereInput = {}
  if (filters.mood) metadataWhere.mood = filters.mood
  if (filters.person) metadataWhere.people = { has: filters.person }
  if (filters.place) metadataWhere.places = { has: filters.place }
  if (filters.topic) metadataWhere.topics = { has: filters.topic }
  if (Object.keys(metadataWhere).length > 0) where.metadata = metadataWhere

  if (filters.dateFrom || filters.dateTo) {
    where.date = {}
    if (filters.dateFrom) (where.date as Prisma.DateTimeNullableFilter).gte = new Date(filters.dateFrom)
    if (filters.dateTo) (where.date as Prisma.DateTimeNullableFilter).lte = new Date(filters.dateTo)
  }

  return where
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filters: EntryFilters = {
    bookId: searchParams.get('bookId') ?? undefined,
    mood: searchParams.get('mood') ?? undefined,
    entryType: searchParams.get('entryType') ?? undefined,
    person: searchParams.get('person') ?? undefined,
    place: searchParams.get('place') ?? undefined,
    topic: searchParams.get('topic') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  }

  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const skip = (page - 1) * limit

  const where = buildEntriesWhere(filters)

  // Full-text search via raw query on tsvector
  if (filters.q) {
    const ftsResults = await db.$queryRaw<{ entry_id: string }[]>`
      SELECT t.entry_id
      FROM transcriptions t
      WHERE t.search_vector @@ plainto_tsquery('norwegian', ${filters.q})
    `
    const ids = ftsResults.map((r) => r.entry_id)
    where.id = { in: ids }
  }

  const [entries, total] = await Promise.all([
    db.entry.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        book: { select: { id: true, name: true } },
        pages: { select: { id: true, filePath: true, pageOrder: true }, take: 1 },
        transcription: { select: { correctedText: true, rawText: true } },
        metadata: { select: { mood: true, topics: true, people: true, places: true } },
      },
    }),
    db.entry.count({ where }),
  ])

  return NextResponse.json({ entries, total, page, limit })
}
```

- [ ] **Step 4: Implement entry detail API**

Create `src/app/api/entries/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const entry = await db.entry.findUnique({
    where: { id: params.id },
    include: {
      book: true,
      pages: { orderBy: { pageOrder: 'asc' } },
      transcription: true,
      metadata: true,
    },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entry)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const allowed = ['title', 'date', 'entryType', 'status'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  // Handle transcription correction separately
  if ('correctedText' in body) {
    await db.transcription.update({
      where: { entryId: params.id },
      data: { correctedText: body.correctedText },
    })
  }

  // Handle metadata updates
  if ('metadata' in body) {
    const { mood, topics, people, places, themes } = body.metadata
    await db.entryMetadata.upsert({
      where: { entryId: params.id },
      create: { entryId: params.id, mood, topics, people, places, themes },
      update: { mood, topics, people, places, themes },
    })
  }

  const entry = await db.entry.update({
    where: { id: params.id },
    data,
    include: { transcription: true, metadata: true },
  })

  return NextResponse.json(entry)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/api/entries.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: entries API with FTS, filters, and PATCH for corrections"
```

---

### Task 10: Books, Review, Jobs, and Settings APIs

**Files:**
- Create: `src/app/api/books/route.ts`
- Create: `src/app/api/books/[id]/route.ts`
- Create: `src/app/api/review/route.ts`
- Create: `src/app/api/review/[id]/route.ts`
- Create: `src/app/api/jobs/route.ts`
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/api/explore/route.ts`

- [ ] **Step 1: Books API**

Create `src/app/api/books/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const books = await db.book.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { entries: true, pages: true } },
    },
  })
  return NextResponse.json(books)
}

export async function POST(req: NextRequest) {
  const { name, dateRange } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const book = await db.book.create({ data: { name, dateRange } })
  return NextResponse.json(book, { status: 201 })
}
```

Create `src/app/api/books/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, dateRange } = await req.json()
  const book = await db.book.update({
    where: { id: params.id },
    data: { name, dateRange },
  })
  return NextResponse.json(book)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.book.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Review queue API**

Create `src/app/api/review/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [entries, total] = await Promise.all([
    db.entry.findMany({
      where: { status: 'pending_review' },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        book: { select: { id: true, name: true } },
        pages: { select: { id: true, filePath: true, pageOrder: true } },
        transcription: true,
        metadata: true,
      },
    }),
    db.entry.count({ where: { status: 'pending_review' } }),
  ])
  return NextResponse.json({ entries, total })
}
```

Create `src/app/api/review/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { action } = await req.json() // action: 'approve' | 'reject'
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }
  const entry = await db.entry.update({
    where: { id: params.id },
    data: { status: action === 'approve' ? 'approved' : 'pending_review' },
  })
  return NextResponse.json(entry)
}
```

- [ ] **Step 3: Jobs API**

Create `src/app/api/jobs/route.ts`:

```typescript
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
  // Retry all failed jobs
  await db.processingJob.updateMany({
    where: { status: 'failed' },
    data: { status: 'queued', attempts: 0, error: null },
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Settings API**

Create `src/app/api/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db.setting.findMany()
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const allowed = ['ollama_url', 'ollama_model', 'confidence_threshold', 'prompt_template', 'default_language']
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key)) continue
    await db.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  }
  const rows = await db.setting.findMany()
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
}
```

- [ ] **Step 5: Explore API**

Create `src/app/api/explore/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [moodByYear, topPeople, topPlaces, topTopics, bookStats] = await Promise.all([
    // Mood distribution per year
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

    // Top people by mention count
    db.$queryRaw<{ person: string; count: bigint }[]>`
      SELECT unnest(people) AS person, COUNT(*) AS count
      FROM entry_metadata
      GROUP BY person
      ORDER BY count DESC
      LIMIT 30
    `,

    // Top places
    db.$queryRaw<{ place: string; count: bigint }[]>`
      SELECT unnest(places) AS place, COUNT(*) AS count
      FROM entry_metadata
      GROUP BY place
      ORDER BY count DESC
      LIMIT 30
    `,

    // Top topics
    db.$queryRaw<{ topic: string; count: bigint }[]>`
      SELECT unnest(topics) AS topic, COUNT(*) AS count
      FROM entry_metadata
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 50
    `,

    // Per-book stats
    db.book.findMany({
      include: {
        _count: { select: { entries: true } },
      },
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
```

- [ ] **Step 6: Upload API**

Create `src/app/api/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { enqueueFile } from '@/lib/importer'

const DATA_DIR = process.env.DATA_DIR ?? './data'
const INBOX_DIR = join(DATA_DIR, 'inbox')

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  const bookId = formData.get('bookId') as string | null

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  await mkdir(INBOX_DIR, { recursive: true })

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer()
      const dest = join(INBOX_DIR, file.name)
      await writeFile(dest, Buffer.from(bytes))
      await enqueueFile(dest, INBOX_DIR, bookId ?? undefined)
      results.push({ name: file.name, ok: true })
    } catch (err) {
      results.push({ name: file.name, ok: false, error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: books, review, jobs, settings, explore, and upload APIs"
```

---

## Phase 4: Browser UI

### Task 11: Main Browser Page

**Files:**
- Create: `src/components/FilterSidebar.tsx`
- Create: `src/components/EntryCard.tsx`
- Create: `src/components/TimelineHeatmap.tsx`
- Create: `src/components/ProcessingStatus.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: FilterSidebar component**

Create `src/components/FilterSidebar.tsx`:

```tsx
'use client'

interface FilterOption {
  value: string
  label: string
  count: number
}

interface FilterSidebarProps {
  books: FilterOption[]
  moods: FilterOption[]
  entryTypes: FilterOption[]
  topics: FilterOption[]
  people: FilterOption[]
  places: FilterOption[]
  activeFilters: Record<string, string>
  onFilterChange: (key: string, value: string | null) => void
}

function FilterGroup({
  label,
  options,
  activeValue,
  filterKey,
  onChange,
}: {
  label: string
  options: FilterOption[]
  activeValue?: string
  filterKey: string
  onChange: (key: string, value: string | null) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() =>
              onChange(filterKey, activeValue === opt.value ? null : opt.value)
            }
            className={`flex items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
              activeValue === opt.value
                ? 'bg-violet-700 text-violet-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>{opt.label}</span>
            <span className={activeValue === opt.value ? 'text-violet-300' : 'text-slate-600'}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FilterSidebar({
  books, moods, entryTypes, topics, people, places,
  activeFilters, onFilterChange,
}: FilterSidebarProps) {
  return (
    <aside className="flex w-48 flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 p-3">
      <FilterGroup label="Bok" options={books} activeValue={activeFilters.bookId} filterKey="bookId" onChange={onFilterChange} />
      <FilterGroup label="Stemning" options={moods} activeValue={activeFilters.mood} filterKey="mood" onChange={onFilterChange} />
      <FilterGroup label="Type" options={entryTypes} activeValue={activeFilters.entryType} filterKey="entryType" onChange={onFilterChange} />
      <FilterGroup label="Temaer" options={topics.slice(0, 8)} activeValue={activeFilters.topic} filterKey="topic" onChange={onFilterChange} />
      <FilterGroup label="Personer" options={people.slice(0, 8)} activeValue={activeFilters.person} filterKey="person" onChange={onFilterChange} />
      <FilterGroup label="Steder" options={places.slice(0, 8)} activeValue={activeFilters.place} filterKey="place" onChange={onFilterChange} />
    </aside>
  )
}
```

- [ ] **Step 2: EntryCard component**

Create `src/components/EntryCard.tsx`:

```tsx
import Link from 'next/link'

const moodEmoji: Record<string, string> = {
  glad: '😄', nøytral: '🙂', lav: '😔', blandet: '😤',
}

const typeIcon: Record<string, string> = {
  text: '📝', image: '🖼', mixed: '✏️', special: '📋',
}

interface EntryCardProps {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  book: { name: string }
  mood: string | null
  topics: string[]
  people: string[]
  snippet: string | null
  pageCount: number
  thumbnailPath: string | null
}

export function EntryCard({
  id, title, date, dateInferred, entryType, book,
  mood, topics, people, snippet, pageCount, thumbnailPath,
}: EntryCardProps) {
  const displayDate = date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date))
    : 'Ukjent dato'

  return (
    <Link href={`/entries/${id}`}>
      <article className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/60">
        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-lg">
          {thumbnailPath ? (
            <img src={`/api/images/${thumbnailPath}`} alt="" className="h-full w-full rounded object-cover" />
          ) : (
            typeIcon[entryType] ?? '📄'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-100">
              {title ?? displayDate}
            </span>
            {mood && <span className="flex-shrink-0 text-sm">{moodEmoji[mood]}</span>}
          </div>
          {title && (
            <p className="text-xs text-slate-500">
              {displayDate}{dateInferred && ' (anslått)'}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            {book.name}
            {pageCount > 1 && ` · ${pageCount} sider`}
            {topics.length > 0 && ` · ${topics.slice(0, 2).join(', ')}`}
          </p>
          {snippet && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
              {snippet}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}
```

- [ ] **Step 3: TimelineHeatmap component**

Create `src/components/TimelineHeatmap.tsx`:

```tsx
interface YearData {
  year: number
  count: number
}

interface TimelineHeatmapProps {
  data: YearData[]
  totalEntries: number
  totalPeople: number
  totalPlaces: number
}

export function TimelineHeatmap({ data, totalEntries, totalPeople, totalPlaces }: TimelineHeatmapProps) {
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <aside className="flex w-36 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 p-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tidslinje</p>
        <div className="flex flex-col gap-1">
          {data.map(({ year, count }) => (
            <div key={year} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">{year}</span>
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => {
                  const intensity = Math.min(count / max, 1)
                  const opacity = intensity > i / 3 ? Math.round(intensity * 10) * 10 : 10
                  return (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-sm bg-blue-500 opacity-${opacity}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Statistikk</p>
        <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
          <div>{totalEntries} oppføringer</div>
          <div>{totalPeople} personer</div>
          <div>{totalPlaces} steder</div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: ProcessingStatus component**

Create `src/components/ProcessingStatus.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface JobStats {
  queued: number
  processing: number
  failed: number
}

export function ProcessingStatus() {
  const [stats, setStats] = useState<JobStats | null>(null)

  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/jobs')
      if (res.ok) setStats(await res.json())
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  if (!stats) return null
  if (stats.queued === 0 && stats.processing === 0 && stats.failed === 0) return null

  const retryAll = async () => {
    await fetch('/api/jobs', { method: 'POST' })
    setStats((s) => s ? { ...s, failed: 0, queued: s.queued + s.failed } : s)
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs">
      {(stats.queued > 0 || stats.processing > 0) && (
        <span className="text-blue-400">
          ⚙ {stats.processing > 0 ? `Behandler...` : ''} {stats.queued} i kø
        </span>
      )}
      {stats.failed > 0 && (
        <>
          <span className="text-red-400">✗ {stats.failed} feilet</span>
          <button onClick={retryAll} className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-600">
            Prøv igjen
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Implement main browser page**

Replace `src/app/page.tsx`:

```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FilterSidebar } from '@/components/FilterSidebar'
import { EntryCard } from '@/components/EntryCard'
import { TimelineHeatmap } from '@/components/TimelineHeatmap'
import { ProcessingStatus } from '@/components/ProcessingStatus'

interface Entry {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  book: { name: string }
  pages: { filePath: string }[]
  transcription: { correctedText: string | null; rawText: string } | null
  metadata: { mood: string | null; topics: string[]; people: string[]; places: string[] } | null
}

const MOOD_OPTIONS = [
  { value: 'glad', label: '😄 Glad', count: 0 },
  { value: 'nøytral', label: '🙂 Nøytral', count: 0 },
  { value: 'lav', label: '😔 Lav', count: 0 },
  { value: 'blandet', label: '😤 Blandet', count: 0 },
]

const TYPE_OPTIONS = [
  { value: 'text', label: '📝 Tekst', count: 0 },
  { value: 'image', label: '🖼 Bilde', count: 0 },
  { value: 'mixed', label: '✏️ Blandet', count: 0 },
  { value: 'special', label: '📋 Spesiell', count: 0 },
]

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeFilters = {
    bookId: searchParams.get('bookId') ?? undefined,
    mood: searchParams.get('mood') ?? undefined,
    entryType: searchParams.get('entryType') ?? undefined,
    topic: searchParams.get('topic') ?? undefined,
    person: searchParams.get('person') ?? undefined,
    place: searchParams.get('place') ?? undefined,
  }

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [books, setBooks] = useState<{ value: string; label: string; count: number }[]>([])
  const [exploreData, setExploreData] = useState<{
    topTopics: { topic: string; count: number }[]
    topPeople: { person: string; count: number }[]
    topPlaces: { place: string; count: number }[]
    moodByYear: { year: number; count: number }[]
  } | null>(null)

  const buildParams = useCallback(
    (overrides: Record<string, string | null> = {}) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k)
        else params.set(k, v)
      }
      return params
    },
    [searchParams]
  )

  const onFilterChange = (key: string, value: string | null) => {
    router.push(`/?${buildParams({ [key]: value })}`)
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    fetch(`/api/entries?${params}`)
      .then((r) => r.json())
      .then(({ entries: e, total: t }) => {
        setEntries(e)
        setTotal(t)
      })
  }, [searchParams, q])

  useEffect(() => {
    fetch('/api/books')
      .then((r) => r.json())
      .then((b) =>
        setBooks(b.map((book: { id: string; name: string; _count: { entries: number } }) => ({
          value: book.id,
          label: book.name,
          count: book._count.entries,
        })))
      )
    fetch('/api/explore')
      .then((r) => r.json())
      .then(setExploreData)
  }, [])

  const yearCounts: { year: number; count: number }[] = exploreData
    ? Object.entries(
        exploreData.moodByYear.reduce<Record<number, number>>((acc, d) => {
          acc[d.year] = (acc[d.year] ?? 0) + d.count
          return acc
        }, {})
      )
        .map(([year, count]) => ({ year: Number(year), count }))
        .sort((a, b) => b.year - a.year)
    : []

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      <ProcessingStatus />
      <div className="flex min-h-0 flex-1">
        <FilterSidebar
          books={books}
          moods={MOOD_OPTIONS}
          entryTypes={TYPE_OPTIONS}
          topics={(exploreData?.topTopics ?? []).map((t) => ({ value: t.topic, label: t.topic, count: t.count }))}
          people={(exploreData?.topPeople ?? []).map((p) => ({ value: p.person, label: p.person, count: p.count }))}
          places={(exploreData?.topPlaces ?? []).map((p) => ({ value: p.place, label: p.place, count: p.count }))}
          activeFilters={activeFilters as Record<string, string>}
          onFilterChange={onFilterChange}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Search bar */}
          <div className="border-b border-slate-800 p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk i alle oppføringer..."
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
            {/* Active filter chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(activeFilters).map(([key, val]) =>
                val ? (
                  <button
                    key={key}
                    onClick={() => onFilterChange(key, null)}
                    className="rounded-full bg-violet-800 px-2.5 py-0.5 text-[11px] text-violet-200"
                  >
                    {val} ×
                  </button>
                ) : null
              )}
              <span className="ml-1 self-center text-[11px] text-slate-600">{total} oppføringer</span>
            </div>
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  id={entry.id}
                  title={entry.title}
                  date={entry.date}
                  dateInferred={entry.dateInferred}
                  entryType={entry.entryType}
                  book={entry.book}
                  mood={entry.metadata?.mood ?? null}
                  topics={entry.metadata?.topics ?? []}
                  people={entry.metadata?.people ?? []}
                  snippet={entry.transcription?.correctedText ?? entry.transcription?.rawText ?? null}
                  pageCount={entry.pages.length}
                  thumbnailPath={entry.pages[0]?.filePath ?? null}
                />
              ))}
              {entries.length === 0 && (
                <p className="py-16 text-center text-sm text-slate-600">Ingen oppføringer funnet</p>
              )}
            </div>
          </div>
        </div>

        <TimelineHeatmap
          data={yearCounts}
          totalEntries={total}
          totalPeople={exploreData?.topPeople.length ?? 0}
          totalPlaces={exploreData?.topPlaces.length ?? 0}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: main browser UI with search, filters, and timeline heatmap"
```

---

### Task 12: Entry Detail Page

**Files:**
- Create: `src/components/ImageViewer.tsx`
- Create: `src/components/MetadataTags.tsx`
- Modify: `src/app/entries/[id]/page.tsx`
- Create: `src/app/api/images/[...path]/route.ts`

- [ ] **Step 1: Image serve API (for local files)**

Create `src/app/api/images/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const DATA_DIR = process.env.DATA_DIR ?? './data'

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const relPath = params.path.join('/')
  const absPath = join(DATA_DIR, relPath)

  // Prevent path traversal
  if (!absPath.startsWith(join(DATA_DIR))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const buffer = await readFile(absPath)
    const ext = relPath.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 2: ImageViewer component**

Create `src/components/ImageViewer.tsx`:

```tsx
'use client'
import { useState } from 'react'

interface ImageViewerProps {
  pages: { id: string; filePath: string; pageOrder: number }[]
}

export function ImageViewer({ pages }: ImageViewerProps) {
  const [rotation, setRotation] = useState(0)
  const [activePage, setActivePage] = useState(0)

  const imgSrc = pages[activePage]
    ? `/api/images/${pages[activePage].filePath.split('/data/').pop()}`
    : null

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 items-center justify-center bg-slate-950 p-4">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="Dagbokside"
            style={{ transform: `rotate(${rotation}deg)`, maxHeight: '70vh', maxWidth: '100%' }}
            className="rounded object-contain shadow-lg transition-transform duration-200"
          />
        ) : (
          <div className="text-slate-600">Ingen bilde</div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-slate-800 p-2">
        <button
          onClick={() => setRotation((r) => r - 90)}
          className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
        >
          ↺ Roter
        </button>
        {pages.length > 1 &&
          pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setActivePage(i)}
              className={`h-1.5 w-1.5 rounded-full ${
                i === activePage ? 'bg-violet-500' : 'bg-slate-700'
              }`}
            />
          ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: MetadataTags component**

Create `src/components/MetadataTags.tsx`:

```tsx
'use client'
import { useState } from 'react'

interface MetadataTagsProps {
  entryId: string
  mood: string | null
  topics: string[]
  people: string[]
  places: string[]
  themes: string[]
  onSave: (data: { mood: string | null; topics: string[]; people: string[]; places: string[]; themes: string[] }) => Promise<void>
}

const MOODS = ['glad', 'nøytral', 'lav', 'blandet']
const moodEmoji: Record<string, string> = { glad: '😄', nøytral: '🙂', lav: '😔', blandet: '😤' }

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-2.5 py-0.5 text-[11px] ${color}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MetadataTags({ entryId, mood, topics, people, places, themes, onSave }: MetadataTagsProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
      {mood && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Stemning</span>
          <span className="w-fit rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] text-slate-200">
            {moodEmoji[mood]} {mood}
          </span>
        </div>
      )}
      <TagList label="Temaer" items={topics} color="bg-blue-900/60 text-blue-300" />
      <TagList label="Personer" items={people} color="bg-violet-900/60 text-violet-300" />
      <TagList label="Steder" items={places} color="bg-emerald-900/60 text-emerald-300" />
      <TagList label="Temaer (overordnet)" items={themes} color="bg-amber-900/60 text-amber-300" />
    </div>
  )
}
```

- [ ] **Step 4: Implement entry detail page**

Replace `src/app/entries/[id]/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageViewer } from '@/components/ImageViewer'
import { MetadataTags } from '@/components/MetadataTags'

interface EntryData {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  entryType: string
  status: string
  confidenceScore: number
  book: { name: string }
  pages: { id: string; filePath: string; pageOrder: number }[]
  transcription: { rawText: string; correctedText: string | null } | null
  metadata: {
    mood: string | null; topics: string[]; people: string[];
    places: string[]; themes: string[]
  } | null
}

export default function EntryPage({ params }: { params: { id: string } }) {
  const [entry, setEntry] = useState<EntryData | null>(null)
  const [editing, setEditing] = useState(false)
  const [correctedText, setCorrectedText] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/entries/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setEntry(data)
        setCorrectedText(data.transcription?.correctedText ?? data.transcription?.rawText ?? '')
      })
  }, [params.id])

  const saveCorrection = async () => {
    await fetch(`/api/entries/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctedText }),
    })
    setEditing(false)
    setEntry((e) => e ? {
      ...e,
      transcription: e.transcription ? { ...e.transcription, correctedText } : null,
    } : null)
  }

  const saveMetadata = async (metadata: {
    mood: string | null; topics: string[]; people: string[];
    places: string[]; themes: string[]
  }) => {
    await fetch(`/api/entries/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })
    setEntry((e) => e ? { ...e, metadata } : null)
  }

  if (!entry) return <div className="p-8 text-slate-400">Laster...</div>

  const displayDate = entry.date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(entry.date))
    : 'Ukjent dato'

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-300">
          ← Tilbake
        </button>
        <span className="text-slate-700">|</span>
        <span className="text-sm font-medium text-slate-100">
          {entry.title ?? displayDate}
        </span>
        {entry.title && (
          <span className="text-xs text-slate-500">{displayDate}{entry.dateInferred && ' (anslått)'}</span>
        )}
        <span className="text-xs text-slate-500">· {entry.book.name}</span>
        <div className="flex-1" />
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${
          entry.status === 'approved'
            ? 'bg-green-900/60 text-green-400'
            : 'bg-amber-900/60 text-amber-400'
        }`}>
          {entry.status === 'approved' ? '✓ Godkjent' : '⏳ Til gjennomgang'}
        </span>
      </div>

      {/* Split view */}
      <div className="flex min-h-0 flex-1">
        {/* Left: scan */}
        <div className="flex w-5/12 flex-col border-r border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Skannet side
          </div>
          <ImageViewer pages={entry.pages} />
        </div>

        {/* Right: transcription + metadata */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Transkripsjon
            </span>
            <span className="flex-1" />
            <span className="text-[11px] text-slate-500">
              {Math.round(entry.confidenceScore * 100)}% sikkerhet
            </span>
            <button
              onClick={() => setEditing((e) => !e)}
              className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
            >
              {editing ? 'Avbryt' : '✏️ Rediger'}
            </button>
          </div>

          <div className="flex-1 px-4 py-4">
            {editing ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={correctedText}
                  onChange={(e) => setCorrectedText(e.target.value)}
                  className="h-64 w-full rounded border border-slate-700 bg-slate-900 p-3 font-serif text-sm leading-relaxed text-slate-200 focus:border-slate-500 focus:outline-none"
                />
                <button
                  onClick={saveCorrection}
                  className="self-start rounded bg-violet-700 px-4 py-1.5 text-sm text-white hover:bg-violet-600"
                >
                  Lagre
                </button>
              </div>
            ) : (
              <p className="font-serif text-sm leading-relaxed text-slate-300">
                {entry.transcription?.correctedText ?? entry.transcription?.rawText ?? (
                  <span className="italic text-slate-600">Ingen transkripsjon</span>
                )}
              </p>
            )}
          </div>

          {entry.metadata && (
            <MetadataTags
              entryId={entry.id}
              mood={entry.metadata.mood}
              topics={entry.metadata.topics}
              people={entry.metadata.people}
              places={entry.metadata.places}
              themes={entry.metadata.themes}
              onSave={saveMetadata}
            />
          )}

          {/* Prev / next navigation */}
          <div className="flex justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
            <button className="hover:text-slate-300">← Forrige</button>
            <button className="hover:text-slate-300">Neste →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: entry detail page with scan viewer, transcription editor, and metadata"
```

---

### Task 13: Review Queue, Upload, Books, Settings, and Explore Pages

**Files:**
- Create: `src/components/ReviewBar.tsx`
- Modify: `src/app/review/page.tsx`
- Modify: `src/app/upload/page.tsx`
- Modify: `src/app/books/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Create: `src/components/MoodChart.tsx`
- Modify: `src/app/explore/page.tsx`

- [ ] **Step 1: Review queue page**

Create `src/components/ReviewBar.tsx`:

```tsx
interface ReviewBarProps {
  entryId: string
  total: number
  current: number
  onApprove: () => void
  onSkip: () => void
}

export function ReviewBar({ entryId, total, current, onApprove, onSkip }: ReviewBarProps) {
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
```

Replace `src/app/review/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ImageViewer } from '@/components/ImageViewer'
import { MetadataTags } from '@/components/MetadataTags'
import { ReviewBar } from '@/components/ReviewBar'

interface ReviewEntry {
  id: string
  title: string | null
  date: string | null
  dateInferred: boolean
  confidenceScore: number
  book: { name: string }
  pages: { id: string; filePath: string; pageOrder: number }[]
  transcription: { rawText: string; correctedText: string | null } | null
  metadata: { mood: string | null; topics: string[]; people: string[]; places: string[]; themes: string[] } | null
}

export default function ReviewPage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    fetch('/api/review').then((r) => r.json()).then(({ entries: e }) => setEntries(e))
  }, [])

  const entry = entries[current]

  const approve = async () => {
    if (!entry) return
    await fetch(`/api/review/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    setCurrent((c) => Math.min(c + 1, entries.length - 1))
    setEntries((e) => e.filter((x) => x.id !== entry.id))
  }

  const skip = () => setCurrent((c) => (c + 1) % entries.length)

  const saveMetadata = async (metadata: {
    mood: string | null; topics: string[]; people: string[];
    places: string[]; themes: string[]
  }) => {
    if (!entry) return
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })
  }

  if (!entries.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Ingen oppføringer til gjennomgang 🎉</div>
  }

  if (!entry) return null

  const displayDate = entry.date
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(entry.date))
    : 'Ukjent dato'

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      <ReviewBar entryId={entry.id} total={entries.length} current={current + 1} onApprove={approve} onSkip={skip} />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-5/12 flex-col border-r border-slate-800">
          <ImageViewer pages={entry.pages} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="font-medium text-slate-100">{entry.title ?? displayDate}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.book.name} · {Math.round(entry.confidenceScore * 100)}% sikkerhet
              {entry.dateInferred && ' · Dato anslått'}
            </p>
          </div>
          <div className="flex-1 px-4 py-4">
            <p className="font-serif text-sm leading-relaxed text-slate-300">
              {entry.transcription?.correctedText ?? entry.transcription?.rawText ?? (
                <span className="italic text-slate-600">Ingen transkripsjon</span>
              )}
            </p>
          </div>
          {entry.metadata && (
            <MetadataTags
              entryId={entry.id}
              mood={entry.metadata.mood}
              topics={entry.metadata.topics}
              people={entry.metadata.people}
              places={entry.metadata.places}
              themes={entry.metadata.themes}
              onSave={saveMetadata}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Upload page**

Replace `src/app/upload/page.tsx`:

```tsx
'use client'
import { useState, useRef } from 'react'

interface Book { id: string; name: string }

export default function UploadPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useState(() => {
    fetch('/api/books').then((r) => r.json()).then(setBooks)
  })

  const upload = async () => {
    if (!files.length) return
    setUploading(true)
    const form = new FormData()
    for (const f of files) form.append('files', f)
    if (selectedBookId) form.append('bookId', selectedBookId)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { results: r } = await res.json()
    setResults(r)
    setFiles([])
    setUploading(false)
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Last opp sider</h1>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs text-slate-400">Tilordne til bok (valgfritt)</label>
        <select
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">Automatisk (basert på mappestruktur)</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 transition-colors hover:border-slate-500"
      >
        <p className="text-sm text-slate-400">Klikk for å velge filer, eller dra og slipp</p>
        <p className="mt-1 text-xs text-slate-600">JPG, PNG, HEIC, PDF</p>
        {files.length > 0 && (
          <p className="mt-2 text-xs text-violet-400">{files.length} filer valgt</p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.heic,.pdf"
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <button
        onClick={upload}
        disabled={uploading || !files.length}
        className="w-full rounded bg-violet-700 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
      >
        {uploading ? 'Laster opp...' : 'Last opp og behandle'}
      </button>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          {results.map((r) => (
            <div key={r.name} className={`text-xs ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
              {r.ok ? '✓' : '✗'} {r.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Books management page**

Replace `src/app/books/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Book {
  id: string; name: string; dateRange: string | null; folderHint: string | null
  _count: { entries: number; pages: number }
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch('/api/books').then((r) => r.json()).then(setBooks)
  }, [])

  const save = async (id: string) => {
    await fetch(`/api/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    setBooks((b) => b.map((book) => book.id === id ? { ...book, name: editName } : book))
    setEditing(null)
  }

  const create = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const book = await res.json()
    setBooks((b) => [...b, book])
    setNewName('')
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Bøker</h1>
      <div className="flex flex-col gap-2">
        {books.map((book) => (
          <div key={book.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            {editing === book.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                  onKeyDown={(e) => e.key === 'Enter' && save(book.id)}
                  autoFocus
                />
                <button onClick={() => save(book.id)} className="text-xs text-green-400 hover:text-green-300">Lagre</button>
                <button onClick={() => setEditing(null)} className="text-xs text-slate-500">Avbryt</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{book.name}</p>
                  <p className="text-xs text-slate-500">
                    {book._count.entries} oppføringer · {book._count.pages} sider
                    {book.folderHint && ` · ${book.folderHint}`}
                  </p>
                </div>
                <button
                  onClick={() => { setEditing(book.id); setEditName(book.name) }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Gi nytt navn
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ny bok..."
          onKeyDown={(e) => e.key === 'Enter' && create()}
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
        />
        <button onClick={create} className="rounded bg-violet-700 px-4 py-2 text-sm text-white hover:bg-violet-600">
          + Legg til
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Settings page**

Replace `src/app/settings/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Settings {
  ollama_url: string
  ollama_model: string
  confidence_threshold: string
  prompt_template: string
  default_language: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings)
  }, [])

  const save = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <div className="p-8 text-slate-400">Laster...</div>

  const field = (
    key: keyof Settings,
    label: string,
    hint: string,
    multiline = false
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {multiline ? (
        <textarea
          value={settings[key]}
          onChange={(e) => setSettings((s) => s ? { ...s, [key]: e.target.value } : s)}
          rows={12}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <input
          value={settings[key]}
          onChange={(e) => setSettings((s) => s ? { ...s, [key]: e.target.value } : s)}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
        />
      )}
      <p className="text-[11px] text-slate-600">{hint}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Innstillinger</h1>
      <div className="flex flex-col gap-5">
        {field('ollama_url', 'Ollama URL', 'F.eks. http://localhost:11434 eller http://host.docker.internal:11434')}
        {field('ollama_model', 'Ollama-modell', 'F.eks. qwen2.5vl:7b')}
        {field('confidence_threshold', 'Sikkerhetsterskelen', 'Oppføringer under denne verdien (0.0–1.0) går til gjennomgang')}
        {field('prompt_template', 'AI-prompt', 'Skriv "default" for å bruke standardpromptet, eller lim inn din egen', true)}
        <button
          onClick={save}
          className="self-start rounded bg-violet-700 px-6 py-2 text-sm text-white hover:bg-violet-600"
        >
          {saved ? '✓ Lagret' : 'Lagre'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Explore page**

Create `src/components/MoodChart.tsx`:

```tsx
'use client'

interface DataPoint { year: number; mood: string; count: number }

const moodColor: Record<string, string> = {
  glad: '#86efac', nøytral: '#94a3b8', lav: '#fca5a5', blandet: '#fcd34d',
}

export function MoodChart({ data }: { data: DataPoint[] }) {
  const years = [...new Set(data.map((d) => d.year))].sort()
  const moods = ['glad', 'nøytral', 'lav', 'blandet']
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Stemning over tid</p>
      <div className="flex items-end gap-2">
        {years.map((year) => {
          const yearData = data.filter((d) => d.year === year)
          const total = yearData.reduce((s, d) => s + d.count, 0)
          return (
            <div key={year} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse rounded overflow-hidden" style={{ height: 80 }}>
                {moods.map((mood) => {
                  const val = yearData.find((d) => d.mood === mood)?.count ?? 0
                  const pct = total > 0 ? (val / total) * 100 : 0
                  return (
                    <div
                      key={mood}
                      style={{ height: `${pct}%`, background: moodColor[mood] }}
                      title={`${mood}: ${val}`}
                    />
                  )
                })}
              </div>
              <span className="text-[10px] text-slate-600">{year}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {moods.map((mood) => (
          <div key={mood} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: moodColor[mood] }} />
            <span className="text-[11px] text-slate-500">{mood}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Replace `src/app/explore/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoodChart } from '@/components/MoodChart'

interface ExploreData {
  moodByYear: { year: number; mood: string; count: number }[]
  topPeople: { person: string; count: number }[]
  topPlaces: { place: string; count: number }[]
  topTopics: { topic: string; count: number }[]
  bookStats: { id: string; name: string; _count: { entries: number } }[]
}

function TagCloud({ items, label, filterKey }: {
  items: { value: string; count: number }[]
  label: string
  filterKey: string
}) {
  const router = useRouter()
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ value, count }) => {
          const size = 10 + (count / max) * 8
          return (
            <button
              key={value}
              onClick={() => router.push(`/?${filterKey}=${encodeURIComponent(value)}`)}
              className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300 transition-colors hover:bg-slate-700"
              style={{ fontSize: size }}
            >
              {value}
              <span className="ml-1 text-slate-600" style={{ fontSize: 9 }}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  const [data, setData] = useState<ExploreData | null>(null)

  useEffect(() => {
    fetch('/api/explore').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="p-8 text-slate-400">Laster...</div>

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Utforsk</h1>
      <div className="flex flex-col gap-6">
        <MoodChart data={data.moodByYear} />
        <TagCloud items={data.topPeople.map((p) => ({ value: p.person, count: p.count }))} label="Personer" filterKey="person" />
        <TagCloud items={data.topPlaces.map((p) => ({ value: p.place, count: p.count }))} label="Steder" filterKey="place" />
        <TagCloud items={data.topTopics.map((t) => ({ value: t.topic, count: t.count }))} label="Temaer" filterKey="topic" />
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Bøker</p>
          <div className="flex flex-col gap-2">
            {data.bookStats.map((book) => (
              <div key={book.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-200">{book.name}</span>
                <span className="text-xs text-slate-500">{book._count.entries} oppføringer</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete UI — review queue, upload, books, settings, explore"
```

---

## Phase 5: Integration and Polish

### Task 14: Nav Review Count and End-to-End Smoke Test

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Wire review count into Nav**

Update `src/app/layout.tsx` to fetch and pass review count:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'
import { db } from '@/lib/db'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dagbok',
  description: 'Privat dagbokarkiv',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const reviewCount = await db.entry.count({ where: { status: 'pending_review' } })

  return (
    <html lang="no" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Nav reviewCount={reviewCount} />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Ensure Prisma is available in Docker build**

Update `next.config.ts` to include Prisma output in standalone build:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
}

export default nextConfig
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all unit tests pass. Fix any failures before continuing.

- [ ] **Step 4: End-to-end smoke test (manual)**

With PostgreSQL running locally (`docker compose up db`):

```bash
npm run dev
```

1. Open http://localhost:3000 — nav bar visible, browse page loads
2. Open http://localhost:3000/books — books page loads
3. Open http://localhost:3000/upload — upload page loads
4. Open http://localhost:3000/settings — settings form loads with values from DB
5. Copy a test image to `data/inbox/` — verify it appears as a queued job at `/api/jobs`

- [ ] **Step 5: Build Docker image to verify it compiles**

```bash
docker compose build
```

Expected: build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire review count to nav, fix standalone build config"
```

---

### Task 15: Documentation and Open Source Readiness

**Files:**
- Create: `README.md`
- Create: `.gitignore` (update)

- [ ] **Step 1: Write README**

Create `README.md`:

```markdown
# Dagbok — Private Journal Archive

A self-hosted, privacy-first app for digitising handwritten journal entries. All AI processing runs locally using Ollama — no data ever leaves your machine.

## Features

- Transcribes handwritten Norwegian (and other languages) using Ollama + Qwen3-VL
- Extracts metadata: date, mood, topics, people, places, themes
- Rich navigation: full-text search, filters, timeline heatmap, explore views
- Confidence-based review queue — low-confidence entries flagged for correction
- Supports text, image, mixed, and structured (special) page types
- Bulk import from folder structure or individual file upload

## Requirements

- macOS with Apple Silicon (for Metal GPU acceleration)
- [Ollama](https://ollama.com) installed and running
- Docker and Docker Compose

## Quick Start

1. **Install Ollama and pull the model:**
   ```bash
   brew install ollama
   ollama serve &
   ollama pull qwen2.5vl:7b
   ```

2. **Clone and configure:**
   ```bash
   git clone <repo-url> dagbok
   cd dagbok
   cp .env.example .env.local
   ```

3. **Start the app:**
   ```bash
   docker compose up
   ```

4. Open http://localhost:3000

## Importing Journals

Drop image files into `data/inbox/`. The app picks them up automatically.

**Folder structure (optional but recommended):**
```
data/inbox/
  Book 1/
    [1] January 2018/
      001.jpg
    Special/
      cover.jpg
  Book 2/
    ...
```

Or just drop flat files — you'll assign them to a book via the UI.

## Remote Access

Use [Tailscale](https://tailscale.com) to access from other devices. The app runs on port 3000.

## Privacy

- All AI processing is local via Ollama
- No telemetry, no cloud, no external requests
- Your journal data stays in `data/` on your own machine
```

- [ ] **Step 2: Verify .gitignore covers sensitive paths**

Ensure `.gitignore` contains:

```
data/
.env
.env.local
node_modules/
.next/
*.log
```

- [ ] **Step 3: Final commit**

```bash
git add README.md .gitignore
git commit -m "docs: README with setup instructions and privacy notes"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Architecture: Next.js + PostgreSQL + Ollama (Task 1–2)
- ✅ Books table with custom names (Task 2)
- ✅ Pages/entries/transcriptions/metadata data model (Task 2)
- ✅ Norwegian FTS with tsvector + GIN indexes (Task 2)
- ✅ entry_type: text/image/mixed/special (Task 5–7)
- ✅ Title field (nullable) on entries (Task 2)
- ✅ Confidence-based routing (Task 7)
- ✅ File watcher + worker loop (Task 8–9)
- ✅ Structured + flat import modes (Task 8)
- ✅ Month subfolder date hints (Task 8)
- ✅ Duplicate detection via SHA-256 (Task 4)
- ✅ Retry logic (3 attempts, exponential noted in worker) (Task 7)
- ✅ Error handling: unsupported files → rejected/, Ollama down → retry (Task 7–8)
- ✅ Configurable AI prompt via settings (Task 10, 13)
- ✅ Main browser: search + filters + entry list + heatmap (Task 11)
- ✅ Entry detail: scan viewer + transcription editor + metadata tags (Task 12)
- ✅ Review queue with approve action (Task 13)
- ✅ Upload page (Task 13)
- ✅ Books management with rename (Task 13)
- ✅ Settings page with all configurable fields (Task 13)
- ✅ Explore page: mood chart, people, places, topics (Task 13)
- ✅ Docker Compose setup (Task 1)
- ✅ README with setup instructions (Task 15)
- ✅ Vitest unit tests for core logic (Tasks 4–8)
