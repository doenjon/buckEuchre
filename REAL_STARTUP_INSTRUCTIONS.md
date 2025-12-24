# 🚀 REAL STARTUP INSTRUCTIONS

**The definitive guide to starting Buck Euchre locally without confusion.**

## ⚠️ Important: Choose Your Method

There are **two ways** to run the app:
1. **Docker Compose** (recommended for production-like environment)
2. **Manual Development** (backend + frontend separately, database in Docker)

**DO NOT MIX THEM.** Pick one method and stick with it.

---

## Method 1: Docker Compose (Production-like)

### Prerequisites
- Docker Desktop running
- No other services using ports 3000, 5173, or 5432

### Step-by-Step

#### 1. Stop Everything First
```bash
# Kill any running processes
pkill -9 -f "tsx" || true
pkill -9 -f "vite" || true
pkill -9 -f "node.*backend" || true
pkill -9 -f "node.*frontend" || true

# Stop any existing Docker containers
docker compose -f docker-compose.yml down
docker compose -f docker-compose.dev.yml down
```

#### 2. Configure Environment Variables

**CRITICAL:** For Docker Compose, the backend must use `postgres` (service name) not `localhost`.

Create or update `/Users/Jon/dev/BuckEuchre/.env`:
```bash
# Database - MUST use 'postgres' as hostname in Docker Compose
DATABASE_URL="postgresql://buckeuchre:dev_password_123@postgres:5432/buckeuchre?connection_limit=50&pool_timeout=20"

# JWT
JWT_SECRET="dev_jwt_secret_for_buck_euchre_do_not_use_in_production_12345678"
JWT_EXPIRES_IN="24h"

# Server
NODE_ENV="production"
PORT="3000"

# CORS
CORS_ORIGIN="http://localhost:5173"

# WebSocket
WS_URL="ws://localhost:3000"

# Logging
LOG_LEVEL="info"

# PostgreSQL (for docker-compose.yml)
POSTGRES_PASSWORD="dev_password_123"
POSTGRES_DB="buckeuchre"
POSTGRES_USER="buckeuchre"
```

#### 3. Build and Start Services

```bash
cd /Users/Jon/dev/BuckEuchre

# Build images
docker compose -f docker-compose.yml build --pull

# Start services (without nginx - we don't have certs locally)
docker compose -f docker-compose.yml up -d postgres backend frontend

# Wait for services to be healthy
sleep 10
docker compose -f docker-compose.yml ps
```

#### 4. Verify Services

```bash
# Check all services are healthy
docker compose -f docker-compose.yml ps

# Test backend
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":...,"database":"connected"}

# Test frontend
curl http://localhost:5173
# Should return HTML
```

#### 5. Access the App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

#### 6. View Logs

```bash
# All services
docker compose -f docker-compose.yml logs -f

# Specific service
docker compose -f docker-compose.yml logs -f backend
docker compose -f docker-compose.yml logs -f frontend
docker compose -f docker-compose.yml logs -f postgres
```

#### 7. Stop Services

```bash
docker compose -f docker-compose.yml down
```

---

## Method 2: Manual Development (Recommended for Development)

### Prerequisites
- Node.js 20+ (use `/Users/Jon/miniforge3/bin/node`)
- Docker Desktop running (for database only)
- No other services using ports 3000 or 5173

### Step-by-Step

#### 1. Stop Everything First
```bash
# Kill any running processes
pkill -9 -f "tsx" || true
pkill -9 -f "vite" || true
pkill -9 -f "node.*backend" || true
pkill -9 -f "node.*frontend" || true

# Stop Docker containers (but keep postgres if using it)
docker compose -f docker-compose.yml down
docker compose -f docker-compose.dev.yml down
```

#### 2. Set Up Node.js Environment

```bash
# Set Node.js path for this session
export PATH="/Users/Jon/miniforge3/bin:$PATH"

# Verify Node.js version (should be 20+)
node --version
# Should show: v22.13.0 or similar

# Verify npm works
npm --version
```

**To make this permanent**, add to `~/.zshrc` or `~/.bash_profile`:
```bash
export PATH="/Users/Jon/miniforge3/bin:$PATH"
```

#### 3. Start Database (Docker)

```bash
cd /Users/Jon/dev/BuckEuchre

# Start only PostgreSQL
docker compose -f docker-compose.dev.yml up -d postgres

# Wait for database to be healthy
sleep 5
docker compose -f docker-compose.dev.yml ps postgres
# Should show: (healthy)
```

#### 4. Configure Backend Environment

**CRITICAL:** For manual development, backend must use `localhost` not `postgres`.

Create or update `/Users/Jon/dev/BuckEuchre/backend/.env`:
```bash
# Database - MUST use 'localhost' when running backend manually
DATABASE_URL="postgresql://buckeuchre:dev_password_123@localhost:5432/buckeuchre?connection_limit=50&pool_timeout=20"

# JWT
JWT_SECRET="dev_jwt_secret_for_buck_euchre_do_not_use_in_production_12345678"
JWT_EXPIRES_IN="24h"

# Server
NODE_ENV="development"
PORT="3000"

# CORS
CORS_ORIGIN="http://localhost:5173"

# WebSocket
WS_URL="ws://localhost:3000"

# Logging
LOG_LEVEL="info"
```

#### 5. Set Up Backend

```bash
cd /Users/Jon/dev/BuckEuchre/backend

# Install dependencies (if needed)
npm install

# Run database migrations
export PATH="/Users/Jon/miniforge3/bin:$PATH"
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

#### 6. Start Backend

```bash
cd /Users/Jon/dev/BuckEuchre/backend

# Set Node.js path
export PATH="/Users/Jon/miniforge3/bin:$PATH"

# Start backend (runs on port 3000)
npm run dev
```

**Keep this terminal open.** You should see:
```
Buck Euchre Backend Server
==========================

Connecting to database...
✅ Database connected successfully
...
[Socket] WebSocket server initialized
Server listening on port 3000
```

#### 7. Set Up Frontend (New Terminal)

Open a **new terminal** and:

```bash
cd /Users/Jon/dev/BuckEuchre/frontend

# Set Node.js path
export PATH="/Users/Jon/miniforge3/bin:$PATH"

# Install dependencies (if needed)
npm install

# Start frontend (runs on port 5173)
npm run dev
```

**Keep this terminal open.** You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

#### 8. Verify Everything Works

```bash
# Test backend health
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":...,"database":"connected"}

# Test frontend
curl http://localhost:5173
# Should return HTML

# Open in browser
open http://localhost:5173
```

#### 9. Stop Services

```bash
# Stop backend: Press Ctrl+C in backend terminal
# Stop frontend: Press Ctrl+C in frontend terminal

# Stop database
docker compose -f docker-compose.dev.yml down
```

---

## 🔧 Troubleshooting

### Problem: "Can't reach database server at `postgres:5432`"

**Cause:** Backend is trying to use Docker service name but running manually.

**Solution:**
1. Check `/Users/Jon/dev/BuckEuchre/backend/.env`
2. Ensure `DATABASE_URL` uses `localhost:5432` (not `postgres:5432`)
3. Restart backend

### Problem: "Can't reach database server at `localhost:5432`"

**Cause:** Backend is in Docker but trying to use localhost.

**Solution:**
1. Check `/Users/Jon/dev/BuckEuchre/.env` (root directory)
2. Ensure `DATABASE_URL` uses `postgres:5432` (not `localhost:5432`)
3. Restart backend container: `docker compose -f docker-compose.yml restart backend`

### Problem: "Node version mismatch" or old Node.js

**Solution:**
```bash
# Check which node is being used
which node
node --version

# If wrong version, set path
export PATH="/Users/Jon/miniforge3/bin:$PATH"

# Verify
node --version
# Should show: v22.13.0 or similar
```

### Problem: "Port already in use"

**Solution:**
```bash
# Find what's using the port
lsof -i :3000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process
kill -9 <PID>

# Or kill all node processes
pkill -9 node
```

### Problem: "Missing module" or "Cannot find module"

**Solution:**
```bash
# Backend
cd /Users/Jon/dev/BuckEuchre/backend
export PATH="/Users/Jon/miniforge3/bin:$PATH"
npm install

# Frontend
cd /Users/Jon/dev/BuckEuchre/frontend
export PATH="/Users/Jon/miniforge3/bin:$PATH"
npm install
```

### Problem: Database connection fails in Docker

**Solution:**
1. Check database is running: `docker compose -f docker-compose.yml ps postgres`
2. Check DATABASE_URL in `.env` uses `postgres:5432`
3. Check password matches: `POSTGRES_PASSWORD` in `.env` matches `DATABASE_URL`
4. Restart backend: `docker compose -f docker-compose.yml restart backend`

### Problem: TypeScript build errors

**Solution:**
```bash
# Fix the error in the code
# Then rebuild

# For Docker
docker compose -f docker-compose.yml build --no-cache frontend

# For manual
cd frontend
export PATH="/Users/Jon/miniforge3/bin:$PATH"
npm run build
```

### Problem: Backend build is very slow

**Solution:**
```bash
# If Docker build is slow, try building without cache
docker compose -f docker-compose.yml build --no-cache backend

# Or rebuild just the backend
docker compose -f docker-compose.yml build backend

# Check if backend container is running
docker compose -f docker-compose.yml ps backend

# If backend was killed, restart it
docker compose -f docker-compose.yml up -d backend
```

### Problem: Stats not being collected

**Solution:**
1. Stats are collected automatically when rounds complete
2. Check backend logs for stats collection:
   ```bash
   docker compose -f docker-compose.yml logs backend | grep -E "STATS|Stats Queue"
   ```
3. Stats are processed asynchronously in a background queue
4. If stats aren't being collected, check that:
   - Backend is running and healthy
   - Players have valid `userId` (not just guest IDs)
   - Rounds are completing successfully

---

## 📋 Quick Reference

### Environment Variables Summary

| Variable | Docker Compose | Manual Development |
|----------|---------------|-------------------|
| `DATABASE_URL` hostname | `postgres` | `localhost` |
| `NODE_ENV` | `production` | `development` |
| `.env` file location | `/Users/Jon/dev/BuckEuchre/.env` | `/Users/Jon/dev/BuckEuchre/backend/.env` |

### Ports

- **3000**: Backend API
- **5173**: Frontend (Vite dev server or nginx)
- **5432**: PostgreSQL

### Service URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Common Commands

```bash
# Check service status (Docker)
docker compose -f docker-compose.yml ps

# View logs (Docker)
docker compose -f docker-compose.yml logs -f

# Stop everything (Docker)
docker compose -f docker-compose.yml down

# Check processes (Manual)
ps aux | grep -E "(tsx|vite|node)"

# Kill all dev processes
pkill -9 -f "tsx"
pkill -9 -f "vite"
```

---

## ✅ Verification Checklist

Before considering the app "up", verify:

- [ ] Database is running and healthy
- [ ] Backend is running on port 3000
- [ ] Frontend is running on port 5173
- [ ] Backend health check returns: `{"status":"ok","database":"connected"}`
- [ ] Frontend loads in browser at http://localhost:5173
- [ ] No errors in browser console
- [ ] No errors in backend logs

---

## 🎯 Recommended Workflow

**For Development:**
1. Use **Method 2: Manual Development**
2. Keep database in Docker: `docker compose -f docker-compose.dev.yml up -d postgres`
3. Run backend and frontend manually with `npm run dev`
4. Hot reload works automatically

**For Testing Production Build:**
1. Use **Method 1: Docker Compose**
2. Build and run everything in Docker
3. Test production configuration

---

## 📝 Notes

- **Never mix methods**: Don't run backend in Docker and frontend manually (or vice versa)
- **Always check DATABASE_URL**: It's the #1 source of connection issues
- **Use correct Node.js**: Always set `PATH="/Users/Jon/miniforge3/bin:$PATH"`
- **Check logs first**: When something doesn't work, check logs before guessing
- **Stats Collection**: Game statistics are automatically collected when rounds complete. Stats are processed asynchronously in a background queue. Check backend logs with `docker compose -f docker-compose.yml logs backend | grep STATS` to verify stats collection.
- **Hot Reloading**: Frontend hot reloading works automatically in development mode. The PWA service worker is disabled in development to prevent caching issues.

---

**Last Updated:** 2025-12-24
**Tested On:** macOS with Docker Desktop and Node.js 22.13.0

