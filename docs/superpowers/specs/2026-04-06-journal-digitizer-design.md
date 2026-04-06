# Journal Digitizer — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

A self-hosted, privacy-first web application for digitising handwritten journal entries. Scanned pages are transcribed using a locally-running AI vision model (Ollama + Qwen3-VL), enriched with structured metadata, and made navigable through a rich search/filter/timeline UI. All data stays on your own machine — no cloud services involved.

Target scale: ~2,900 pages across 8 physical journals spanning 8 years, with ongoing new entries.

---

## Architecture

### Components

| Component | Technology | Deployment |
|---|---|---|
| Frontend + API | Next.js 15 + TypeScript | Docker |
| Database | PostgreSQL (Norwegian FTS) | Docker |
| AI model | Ollama + Qwen3-VL | Native macOS (Metal GPU) |
| Remote access | Tailscale | Host network |

### Deployment

Docker Compose runs two services (Next.js app + PostgreSQL) on the user's machine. Ollama runs natively outside Docker to access Apple Silicon GPU acceleration via Metal. The app is always-on and accessible locally at `http://localhost:3000` and remotely via Tailscale.

The file watcher runs as a Node.js child process spawned by Next.js on startup — no extra service required.

### Future extensibility

MeiliSearch can be added as a third Docker Compose service for enhanced search and faceted filtering without any changes to the data model or API contracts.

### Folder structure (runtime)

```
data/
  inbox/          # Drop scans here, or upload via UI — watcher picks up from here
  processed/      # Originals moved here after successful ingestion
  images/         # Web-optimised copies served to the frontend
```

---

## Data Model

### `books`
One row per physical journal.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | User-defined display name (e.g. "Rødboka", "Book 4") |
| folder_hint | text | Original folder name used during import, for reference |
| date_range | text | Optional label (e.g. "2018–2019") |
| created_at | timestamptz | |

### `pages`
One row per scanned image file.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| book_id | uuid | FK → books |
| entry_id | uuid | FK → entries, nullable until grouped |
| file_path | text | Path in `data/images/` |
| original_path | text | Path in `data/processed/` |
| file_hash | text | SHA-256, used for duplicate detection |
| page_order | int | Order within entry |
| ingested_at | timestamptz | |

### `entries`
One or more pages grouped into a single journal entry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| book_id | uuid | FK → books |
| title | text | Nullable — AI-extracted or user-set |
| date | date | Nullable — explicit date from page content |
| date_inferred | bool | True if AI estimated the date |
| entry_type | enum | `text`, `image`, `mixed`, `special` |
| status | enum | `pending_review`, `approved` |
| confidence_score | float | 0.0–1.0, drives auto-approve vs review queue |
| created_at | timestamptz | |

**`entry_type` values:**
- `text` — prose writing with readable text (date may be explicit, inferred, or absent)
- `image` — drawing, photograph, or purely visual page
- `mixed` — prose + embedded images/drawings
- `special` — structured pages (habit trackers, monthly indices, numbered lists, tables) from a Special folder or identified by the AI; associated with a book but no date required

### `transcriptions`
The text content of an entry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| entry_id | uuid | FK → entries |
| raw_text | text | Immutable AI output — never modified |
| corrected_text | text | Nullable — user edits stored here |
| language | text | Default: `no` |

Full-text search index is on `corrected_text` (falling back to `raw_text`) using PostgreSQL `tsvector` with the `norwegian` text search configuration for proper stemming.

### `entry_metadata`
Extracted signals and tags for an entry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| entry_id | uuid | FK → entries |
| mood | enum | `glad`, `nøytral`, `lav`, `blandet` — nullable |
| topics | text[] | AI-extracted topic tags |
| people | text[] | People mentioned by name |
| places | text[] | Locations mentioned |
| themes | text[] | Higher-level recurring themes |

All array columns are indexed with GIN for efficient filtering.

### `processing_jobs`
Tracks ingestion state per page.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| page_id | uuid | FK → pages |
| status | enum | `queued`, `processing`, `done`, `failed` |
| error | text | Nullable — failure reason |
| attempts | int | Retry count |
| started_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |

---

## Ingestion Pipeline

### Import modes

The importer supports two input structures:

**Structured** (folder hierarchy): Subfolders are detected and suggested as books automatically. A `Special/` subfolder within a book folder is recognised and flagged. Month subfolders (e.g. `[11] November 19`) are parsed to extract a month/year hint that narrows the AI's date inference for all pages within that folder. The user confirms the book mapping in the UI before processing starts. Folder names become the default `folder_hint` and suggested book name (which the user can rename).

**Flat/unstructured**: A pile of files with no subfolders. Files enter an "awaiting assignment" state. The user picks or creates a book before processing begins.

Both modes feed into the same `inbox/` → watcher pipeline.

### Processing flow

```
1.  File detected in inbox/ by file watcher
2.  Duplicate check (SHA-256 hash) — skip if already exists
3.  processing_job created (status: queued)
4.  Worker picks up job:
    a. Sends image to Ollama (Qwen3-VL) with structured prompt
    b. Prompt requests: entry_type, title, date, transcription,
       mood, topics, people, places, themes, confidence_score
    c. Response validated against JSON schema
5.  entry_type routing:
    - image → skip transcription; store visual description as raw_text
    - special → transcribe whatever text is present; title extracted if identifiable
    - text/mixed → full transcription + metadata extraction
6.  Confidence score decision:
    - ≥ 0.85 → status: approved (auto-saved)
    - < 0.85 → status: pending_review (flagged for review)
7.  Original moved to processed/; web-optimised copy saved to images/
8.  processing_job marked done
9.  UI shows live processing status (polled via API)
```

### Error handling

- **Ollama unreachable**: job retried up to 3 times with exponential backoff, then marked `failed`. UI banner shows count of stuck jobs with a "Retry all" button.
- **Malformed AI response**: job fails gracefully; entry lands in review queue with a note explaining the failure reason.
- **Unsupported file type**: file moved to `inbox/rejected/` with a log entry. Accepted types: `.jpg`, `.jpeg`, `.png`, `.heic`, `.pdf` (single-page).
- **Duplicate file**: detected by hash, skipped silently.

### AI prompt

The transcription prompt is stored as a configurable setting (editable in the app's Settings page) so users can tune it for their handwriting style, language, or model without touching code. The default prompt is optimised for Norwegian handwriting with Qwen3-VL.

---

## Frontend

### Pages / routes

| Route | Purpose |
|---|---|
| `/` | Main journal browser (search + filter + timeline) |
| `/entries/[id]` | Entry detail — scan image + transcription + metadata |
| `/review` | Review queue — pending entries awaiting approval |
| `/upload` | Upload new scans / trigger bulk import |
| `/books` | Manage books — rename, reorder, view stats |
| `/explore` | Visual exploration — mood over time, people graph, topic cloud |
| `/settings` | Ollama URL, confidence threshold, prompt template, language |

### Main browser (`/`)

Three-panel layout:

- **Left sidebar**: faceted filters — mood, entry type, topics, people, places, books. Each filter shows entry count. Filters are combinable.
- **Centre**: search bar at top (full-text, Norwegian-stemmed), active filters shown as dismissible chips below it, entry list below that. Each entry card shows: date, title (if present), book, mood, a snippet of transcription, entry type indicator. Multi-page entries show a stacked card visual.
- **Right sidebar**: year-by-year heatmap (entry density), mood trend over time, aggregate stats (total entries, people, places).

### Entry detail (`/entries/[id]`)

Split view:
- **Left**: scanned page image with zoom and rotate controls. Multi-page entries show page thumbnails below.
- **Right**: transcription (raw or corrected), metadata tags (mood, topics, people, places), edit controls. Prev/next navigation at the bottom. AI confidence score shown near the transcription header.

### Review queue (`/review`)

Same layout as entry detail, but with an "Approve / Edit" action bar at the top. Reason for flagging is shown (low confidence, AI parse failure, etc.). Approving moves status to `approved` and removes from queue.

### Explore (`/explore`)

Rich navigation views beyond simple filtering:
- **Mood timeline**: line/area chart of mood distribution over time
- **People network**: list of people sorted by mention frequency, click to see all entries mentioning them
- **Places map**: list of places with entry counts, click to filter
- **Topic cloud**: weighted tag cloud, click to filter
- **Book overview**: per-book stats (entry count, date range, mood breakdown)

---

## Testing

- **Unit tests** (Vitest): ingestion pipeline logic — job queue, confidence score routing, file hash deduplication, path parsing for structured/flat imports, JSON schema validation of AI responses.
- **Integration tests**: API routes tested against a real PostgreSQL instance run via Docker in CI. No database mocking.
- **AI layer**: not tested directly. The contract (JSON schema of the AI response) is validated; model output quality is not.

---

## Open Source Considerations

- `docker compose up` (after installing Ollama separately) is the full setup for most users.
- Ollama installation is documented with a one-liner. Model pull (`ollama pull qwen3-vl`) is triggered automatically on first run if the model is not present.
- No API keys, no cloud accounts, no telemetry.
- The AI prompt is user-configurable — important for users with different languages or handwriting styles.
- `.env.example` provided for all configuration (Ollama URL, confidence threshold, DB connection).
- `data/` directory is excluded from git. Users own their data entirely.
