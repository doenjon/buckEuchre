#!/bin/bash
# Fix failed Prisma migration on production server
# Run this on your production server

echo "🔧 Fixing failed Prisma migration..."

# Option 1: Mark the failed migration as rolled back (if migration partially applied)
echo "Attempting to resolve failed migration..."
docker compose exec backend npx prisma migrate resolve --rolled-back 20251101183955_init

# If that doesn't work, try Option 2: Mark it as applied (if migration actually succeeded)
# docker compose exec backend npx prisma migrate resolve --applied 20251101183955_init

# If database is truly fresh and empty, Option 3: Reset migration state
# docker compose exec postgres psql -U buckeuchre -d buckeuchre -c "TRUNCATE TABLE \"_prisma_migrations\";"

echo ""
echo "✅ Migration state fixed. Restarting backend..."
docker compose restart backend

echo ""
echo "Check backend logs:"
docker compose logs --tail=50 backend

