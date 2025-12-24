#!/bin/bash
# Reset remote production database
# WARNING: This deletes ALL data in the database
# Run this on your production server

set -e

echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo ""
echo "This script will:"
echo "  1. Stop the backend service"
echo "  2. Reset the database using Prisma migrate reset"
echo "  3. Restart the backend service"
echo ""
echo "Press Ctrl+C to cancel, or wait 10 seconds to continue..."
sleep 10

echo ""
echo "🛑 Stopping backend service..."
cd "$(dirname "$0")"
docker compose stop backend || echo "Backend already stopped"

echo ""
echo "🗑️  Resetting database..."
echo "This will drop all tables and recreate them from migrations..."

# Run Prisma migrate reset inside the backend container
# This will drop the database, recreate it, and run all migrations
docker compose exec -T backend npx prisma migrate reset --force --skip-seed || {
  echo "⚠️  Error: Could not run migrate reset in container"
  echo "Trying alternative method..."
  
  # Alternative: Connect directly to database and drop/recreate
  echo "Connecting to database directly..."
  docker compose exec -T postgres psql -U buckeuchre -d buckeuchre <<EOF
-- Drop all tables (cascade to handle foreign keys)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO buckeuchre;
GRANT ALL ON SCHEMA public TO public;
EOF

  echo "Running migrations..."
  docker compose exec -T backend npx prisma migrate deploy
}

echo ""
echo "✅ Database reset complete!"
echo ""
echo "🚀 Restarting backend service..."
docker compose up -d backend

echo ""
echo "⏳ Waiting for backend to start..."
sleep 5

echo ""
echo "📊 Checking backend status..."
docker compose ps backend

echo ""
echo "📋 Backend logs (last 20 lines):"
docker compose logs --tail=20 backend

echo ""
echo "✅ Done! Database has been reset and backend restarted."
echo ""
echo "To check if everything is working:"
echo "  docker compose logs -f backend"
echo ""
echo "To verify database:"
echo "  docker compose exec backend npx prisma studio"

