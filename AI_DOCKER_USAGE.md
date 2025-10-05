## AI Docker Usage Guide

This guide explains how to start, verify, and use the Buck Euchre Dockerized stack (Postgres, Backend, Frontend, Nginx), and how to run integration tests against it.

### Prerequisites
- Docker and Docker Compose v2 installed
- Copy `env.example` → `.env` (at repo root) and set required variables:
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL` (example: `postgresql://buckeuchre:dev_password_123_local_only@postgres:5432/buckeuchre`)
  - `JWT_SECRET`
  - `CORS_ORIGIN` (example: `http://localhost:5173`)
- Optional (host port overrides):
  - `HTTP_PORT=80`
  - `HTTPS_PORT=443`

### Quick Start
```bash
# From the repository root
docker compose up -d
```

This starts:
- `postgres` (exposed `5432:5432` for local tools/tests)
- `backend` (exposed `3000:3000`, runs Prisma migrations automatically)
- `frontend` (built via Dockerfile)
- `nginx` (reverse proxy on ports 80/443 by default)

### Health Checks
- Backend: `curl http://localhost:3000/health` → should return 200
- Nginx: `curl http://localhost/health` → should return 200
- Postgres: `docker compose ps` → `postgres` should be healthy

### Access
- App (via Nginx): `http://localhost`
- Backend API (direct, for testing): `http://localhost:3000`
- Database (host tools like psql): `localhost:5432`

### Common Commands
```bash
# Follow logs across services
docker compose logs -f

# Restart only backend
docker compose restart backend

# Stop all
docker compose down

# Rebuild backend after code changes
docker compose build backend && docker compose up -d backend
```

### Running Integration Tests (from host)
Ensure `postgres` and `backend` are running (compose up). Then:
```bash
cd backend
npm test -- --testPathPattern="integration"
```
Notes:
- Tests use a host-facing `DATABASE_URL` (configured in test setup) targeting `localhost:5432`.
- Backend is reachable at `http://localhost:3000` for REST and WebSocket endpoints.

### Environment Details (summarized from docker-compose.yml)
- Postgres
  - `POSTGRES_DB=buckeuchre` (default)
  - `POSTGRES_USER=buckeuchre` (default)
  - `POSTGRES_PASSWORD` (required)
  - Ports: `5432:5432`
- Backend
  - `PORT=3000`
  - `DATABASE_URL` (required; use hostname `postgres` inside Docker network)
  - `JWT_SECRET`, `CORS_ORIGIN` (required)
  - Entrypoint: `npx prisma migrate deploy && node dist/app/src/index.js`
  - Health: `GET /health`
  - Ports: `3000:3000`
- Frontend
  - Built and served behind Nginx
- Nginx
  - Mounts configs from `./nginx/`
  - Ports: `80` and `443` (configurable via `HTTP_PORT`/`HTTPS_PORT`)

### Deterministic Test Runs
- Tests set `SHUFFLE_SEED` automatically to make card shuffling deterministic; no change needed for production.

### Troubleshooting
- Backend cannot reach DB:
  - Check `docker compose ps` for `postgres` health
  - Verify `DATABASE_URL` uses `postgres` (in-network) for containers and `localhost` for host tools/tests
- Prisma engine errors:
  - Rebuild backend inside Docker so native binaries match container arch:
    ```bash
    docker compose build backend && docker compose up -d backend
    ```
- Port conflicts:
  - Stop other services using `80`, `3000`, or `5432`, or change published ports in `docker-compose.yml`

### Optional: Clean Start
```bash
docker compose down -v   # stop and remove volumes
docker compose up -d
```

This resets Postgres data (`postgres-data` volume) and starts fresh.


