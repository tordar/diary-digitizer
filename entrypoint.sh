#!/bin/sh
set -e

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Seed default settings (only if not already set)
node_modules/.bin/tsx scripts/seed.ts || echo "[seed] Skipped (non-fatal)"

# Start file watcher in background
node_modules/.bin/tsx scripts/watcher.ts &

# Start Next.js
exec node server.js
