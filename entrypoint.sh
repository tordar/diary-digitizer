#!/bin/sh
set -e

# Run migrations
npx prisma migrate deploy

# Start file watcher in background
node scripts/watcher.js &

# Start Next.js
exec node server.js
