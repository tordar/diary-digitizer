#!/bin/sh
set -e

# Run migrations
node_modules/.bin/prisma migrate deploy

# Start file watcher in background
tsx scripts/watcher.ts &

# Start Next.js
exec node server.js
