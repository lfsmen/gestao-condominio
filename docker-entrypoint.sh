#!/bin/sh
set -e

echo "🔍 Waiting for database to be ready..."
until nc -z db 5432; do
  echo "⏳ Database is not ready yet..."
  sleep 1
done
echo "✅ Database is ready!"

echo "🚀 Running database migrations..."
npx --yes prisma@5.22.0 migrate deploy

echo "🌱 Seeding database (if needed)..."
npx --yes prisma@5.22.0 db seed || true

echo "🎉 Starting application..."
exec node server.js
