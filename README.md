# Dagbok — Private Journal Archive

A self-hosted, privacy-first app for digitising handwritten journal entries. All AI processing runs locally using Ollama — no data ever leaves your machine.

## Features

- Transcribes handwritten Norwegian (and other languages) using Ollama + Qwen2.5-VL
- Extracts metadata: date, mood, topics, people, places, themes
- Rich navigation: full-text search, filters, timeline heatmap, explore views
- Confidence-based review queue — low-confidence entries flagged for correction
- Supports text, image, mixed, and structured (special) page types
- Bulk import from folder structure or individual file upload via the web UI

## Requirements

- macOS with Apple Silicon (for Metal GPU acceleration via Ollama)
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

Or drop flat files into `data/inbox/` — you can assign them to a book via the UI at `/upload`.

## Remote Access

Use [Tailscale](https://tailscale.com) to access from other devices on your network. The app runs on port 3000.

## Configuration

All settings are configurable via the Settings page (`/settings`):

| Setting | Default | Description |
|---|---|---|
| Ollama URL | `http://host.docker.internal:11434` | Where Ollama is running |
| Ollama model | `qwen2.5vl:7b` | Vision model for transcription |
| Confidence threshold | `0.85` | Entries below this go to review queue |
| AI prompt | `default` | Custom prompt template for your handwriting |

## Development

```bash
# Install dependencies
npm install

# Start database
docker compose up db

# Run dev server + file watcher
npm run dev

# Run tests
npm test
```

Copy `.env.example` to `.env.local` and adjust values for local development.

## Architecture

| Component | Technology | Notes |
|---|---|---|
| Frontend + API | Next.js 16 + TypeScript | Docker |
| Database | PostgreSQL 16 + Norwegian FTS | Docker |
| AI model | Ollama + Qwen2.5-VL | Native macOS (Metal GPU) |
| Remote access | Tailscale | Host network |

The file watcher runs as a Node.js child process alongside Next.js. Scanned images are processed through Ollama, transcribed, and stored in PostgreSQL with full-text search indexes.

## Data

All data lives in the `data/` directory (excluded from git):

```
data/
  inbox/      # Drop files here for ingestion
  processed/  # Original files after ingestion
  images/     # Web-optimised copies
  rejected/   # Unsupported or unreadable files
```

## Privacy

- No cloud services, no telemetry, no API keys required
- All AI processing runs locally on your machine
- Your journal data never leaves your device
