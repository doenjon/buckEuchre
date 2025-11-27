# Deployment Troubleshooting Guide

## Backend Container Restarting

If the backend container is restarting continuously, check the logs:

```bash
# Check backend logs (most recent 100 lines)
docker compose logs --tail=100 backend

# Follow logs in real-time
docker compose logs -f backend

# Check if migrations are running
docker compose logs backend | grep -i "migrate\|prisma\|database"
```

## Common Issues

### 1. Migration Failure

**Symptoms:** Container restarts immediately after starting

**Check:**
```bash
docker compose logs backend | grep -A 10 "prisma migrate"
```

**Solution:**
- If database is empty/fresh, migrations should work
- If old Player table exists, you may need to reset the database:
  ```bash
  docker compose exec postgres psql -U buckeuchre -d buckeuchre -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  ```

### 2. Missing Environment Variables

**Symptoms:** Error about missing DATABASE_URL, JWT_SECRET, or CORS_ORIGIN

**Check:**
```bash
# Verify environment variables are set
docker compose exec backend env | grep -E "DATABASE_URL|JWT_SECRET|CORS_ORIGIN"
```

**Solution:**
- Ensure `.env` file exists in project root
- Verify all required variables are set (see `env.example`)

### 3. Wrong File Path

**Symptoms:** `Error: Cannot find module 'dist/app/src/index.js'`

**Check:**
```bash
# Check what files actually exist in the container
docker compose exec backend ls -la dist/
docker compose exec backend ls -la dist/src/
```

**Solution:**
- The path might be `dist/src/index.js` instead of `dist/app/src/index.js`
- Check `backend/tsconfig.json` output directory
- Update `docker-compose.yml` command if needed

### 4. Database Connection Issues

**Symptoms:** Connection refused or timeout errors

**Check:**
```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres | tail -50

# Test connection
docker compose exec backend node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

**Solution:**
- Verify DATABASE_URL matches docker-compose postgres settings
- Check postgres container health
- Ensure postgres is fully started before backend (dependency should handle this)

### 5. Permission Issues

**Symptoms:** Permission denied errors

**Check:**
```bash
# Check file permissions in container
docker compose exec backend ls -la dist/src/index.js
docker compose exec backend whoami
```

**Solution:**
- Files should be owned by `nodejs:nodejs` (user 1001)
- Check Dockerfile USER directive

## Quick Diagnostics

Run these commands on your server to diagnose:

```bash
# 1. Check container status
docker compose ps

# 2. Check backend logs
docker compose logs --tail=50 backend

# 3. Check if migrations ran
docker compose logs backend | grep -i "migrate\|Applied\|Migration"

# 4. Check database connection
docker compose exec postgres pg_isready -U buckeuchre

# 5. Check environment variables
docker compose exec backend env | grep -E "DATABASE_URL|JWT_SECRET|CORS_ORIGIN|NODE_ENV|PORT"

# 6. Check file structure
docker compose exec backend find dist -name "index.js" -type f

# 7. Test manual startup
docker compose exec backend sh -c "npx prisma migrate deploy && node dist/src/index.js"
```

## Most Likely Issue: File Path

Based on `tsconfig.json`:
- `outDir: "./dist"` 
- Source: `src/index.ts`
- Output should be: `dist/src/index.js`

But `docker-compose.yml` command references: `dist/app/src/index.js`

**Fix:** Update `docker-compose.yml` line 89:
```yaml
command: >
  sh -c "npx prisma migrate deploy &&
         node dist/src/index.js"
```

Or check the actual structure and adjust accordingly.



