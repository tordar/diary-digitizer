#!/bin/sh
set -e

# Run migrations
npx prisma migrate deploy

# Start file watcher in background
tsx scripts/watcher.ts &

# Start Next.js
exec node server.js
