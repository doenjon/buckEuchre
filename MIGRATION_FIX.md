# Fix Failed Prisma Migration (P3009 Error)

## Problem
Prisma detected a failed migration in the database and won't apply new migrations until it's resolved.

## Solution

Run these commands **on your production server**:

### Option 1: Mark Migration as Rolled Back (Recommended if migration partially failed)

```bash
docker compose exec backend npx prisma migrate resolve --rolled-back 20251101183955_init
docker compose restart backend
```

### Option 2: Mark Migration as Applied (If migration actually succeeded)

If the migration actually completed but was marked as failed:

```bash
docker compose exec backend npx prisma migrate resolve --applied 20251101183955_init
docker compose restart backend
```

### Option 3: Reset Migration State (If database is truly fresh)

If your database is completely fresh and empty, you can reset the migration tracking:

```bash
# Connect to database
docker compose exec postgres psql -U buckeuchre -d buckeuchre

# Run these SQL commands:
TRUNCATE TABLE "_prisma_migrations";
\q

# Then restart backend
docker compose restart backend
```

### Option 4: Fresh Start (Nuclear option - deletes all data)

If you're okay with losing all data and starting completely fresh:

```bash
# Stop services
docker compose down

# Remove database volume
docker volume rm buckeuchre_postgres-data 2>/dev/null || true

# Or if volume name is different, check:
docker volume ls | grep postgres

# Restart services (migrations will run fresh)
docker compose up -d
```

## Verify Fix

After applying one of the fixes, check backend logs:

```bash
docker compose logs --tail=100 backend
```

You should see:
- ✅ Migration applied successfully
- ✅ Server starting on port 3000

## Prevent Future Issues

To avoid this in the future:
- Always let migrations complete before stopping containers
- Use `prisma migrate deploy` in production (not `migrate dev`)
- Test migrations locally before deploying



