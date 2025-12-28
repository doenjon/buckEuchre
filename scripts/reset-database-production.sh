#!/bin/bash
# Reset production database and start fresh
# WARNING: This deletes ALL data in the database

set -e

echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo ""
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

echo ""
echo "🛑 Stopping services..."
docker compose down

echo ""
echo "🗑️  Removing database volume..."
# Find the postgres volume name
VOLUME_NAME=$(docker volume ls | grep -i postgres | grep buckeuchre | awk '{print $2}' || echo "buckeuchre_postgres-data")

if [ -z "$VOLUME_NAME" ]; then
  echo "Could not find database volume. Checking all volumes..."
  docker volume ls | grep postgres
  echo ""
  read -p "Enter the postgres volume name (or press Enter to skip): " VOLUME_NAME
fi

if [ -n "$VOLUME_NAME" ]; then
  docker volume rm "$VOLUME_NAME" || echo "Volume removal failed or volume doesn't exist"
else
  echo "Skipping volume removal. You may need to remove it manually."
fi

echo ""
echo "✅ Database volume removed"
echo ""
echo "🚀 Starting services with fresh database..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "📋 Service status:"
docker compose ps

echo ""
echo "📊 Backend logs (checking migration):"
docker compose logs --tail=50 backend | grep -i "migrate\|applied\|error" || docker compose logs --tail=20 backend

echo ""
echo "✅ Done! Backend should now be running with a fresh database."
echo ""
echo "To check backend logs: docker compose logs -f backend"



