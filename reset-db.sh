#!/bin/bash
# Reset database script - Use this to completely reset your database
# This will DELETE ALL DATA and apply migrations from scratch

set -e

echo "🗄️  Resetting Buck Euchre database..."
echo "⚠️  WARNING: This will DELETE ALL DATA!"
echo ""

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Ensure postgres is running
echo "1️⃣  Ensuring postgres container is running..."
docker-compose -f docker-compose.dev.yml up -d postgres

# Wait for postgres to be ready
echo "2️⃣  Waiting for postgres to be ready..."
for i in {1..30}; do
    if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U buckeuchre &> /dev/null; then
        echo "   ✓ Postgres is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ Timeout waiting for postgres"
        exit 1
    fi
    sleep 1
done

# Reset database using Prisma
echo "3️⃣  Resetting database and applying all migrations..."
cd backend
export DATABASE_URL="postgresql://buckeuchre:dev_password_123@localhost:5432/buckeuchre"
npx prisma migrate reset --force
cd ..

echo ""
echo "✅ Database reset complete!"
echo "   - All tables dropped and recreated"
echo "   - All migrations applied in order"
echo "   - Database is ready for use"
