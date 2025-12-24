#!/bin/bash
# Complete database reset - removes volume for fresh start
# WARNING: This DELETES ALL DATA permanently
# Run this on your production server

set -e

echo "⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️"
echo ""
echo "This will PERMANENTLY DELETE ALL DATA in the database!"
echo "This includes:"
echo "  - All users and accounts"
echo "  - All game history"
echo "  - All statistics"
echo "  - Everything else in the database"
echo ""
echo "This script will:"
echo "  1. Stop ALL services (backend, postgres, etc.)"
echo "  2. Remove the database volume (deletes all data)"
echo "  3. Restart all services (creates fresh database)"
echo "  4. Run migrations to set up schema"
echo ""
echo "Press Ctrl+C to cancel, or wait 15 seconds to continue..."
sleep 15

echo ""
echo "🛑 Stopping all services..."
cd "$(dirname "$0")"
docker compose down

echo ""
echo "🗑️  Removing database volume..."
echo "This permanently deletes all database data..."

# Find and remove the postgres volume
VOLUME_NAME=$(docker volume ls | grep -i postgres | grep -i buckeuchre | awk '{print $2}' | head -1)

if [ -z "$VOLUME_NAME" ]; then
  # Try to find it by the compose project name
  VOLUME_NAME=$(docker volume ls | grep postgres-data | awk '{print $2}' | head -1)
fi

if [ -n "$VOLUME_NAME" ]; then
  echo "Found volume: $VOLUME_NAME"
  docker volume rm "$VOLUME_NAME" || {
    echo "⚠️  Could not remove volume (might be in use or not exist)"
    echo "Continuing anyway..."
  }
else
  echo "⚠️  Could not find postgres volume automatically"
  echo "Listing all volumes:"
  docker volume ls
  echo ""
  read -p "Enter volume name to remove (or press Enter to skip): " VOLUME_NAME
  if [ -n "$VOLUME_NAME" ]; then
    docker volume rm "$VOLUME_NAME" || echo "Could not remove volume"
  fi
fi

echo ""
echo "🧹 Cleaning up any orphaned containers..."
docker compose down --remove-orphans

echo ""
echo "🚀 Starting all services (will create fresh database)..."
docker compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

# Wait for postgres to be healthy
echo "Waiting for PostgreSQL to be healthy..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U buckeuchre > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  PostgreSQL did not become ready in time"
  else
    echo "  Waiting... ($i/30)"
    sleep 2
  fi
done

echo ""
echo "📊 Running migrations..."
docker compose exec -T backend npx prisma migrate deploy || {
  echo "⚠️  Error running migrations, trying to generate client first..."
  docker compose exec -T backend npx prisma generate
  docker compose exec -T backend npx prisma migrate deploy
}

echo ""
echo "✅ Complete database reset finished!"
echo ""
echo "📊 Service status:"
docker compose ps

echo ""
echo "📋 Backend logs (last 30 lines):"
docker compose logs --tail=30 backend

echo ""
echo "✅ Done! Database has been completely reset and services restarted."
echo ""
echo "The database is now completely fresh with:"
echo "  - All migrations applied"
echo "  - No user data"
echo "  - No game history"
echo "  - Clean slate"
echo ""
echo "To check if everything is working:"
echo "  docker compose logs -f backend"
echo ""
echo "To verify database:"
echo "  docker compose exec backend npx prisma studio"

