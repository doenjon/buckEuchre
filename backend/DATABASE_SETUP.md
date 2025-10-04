# Database Setup Guide

This guide explains how to set up PostgreSQL and initialize the database for Buck Euchre.

## Prerequisites

- PostgreSQL 16 (or Docker with PostgreSQL image)
- Node.js 20+ and npm

## Option 1: Local PostgreSQL Installation

### Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER buckeuchre WITH PASSWORD 'password';
CREATE DATABASE buckeuchre OWNER buckeuchre;
GRANT ALL PRIVILEGES ON DATABASE buckeuchre TO buckeuchre;

# Exit
\q
```

### Update Environment Variables

Edit `backend/.env` and update the DATABASE_URL:
```env
DATABASE_URL="postgresql://buckeuchre:password@localhost:5432/buckeuchre"
```

## Option 2: Docker PostgreSQL

### Using Docker Compose (Recommended)

Create `docker-compose.dev.yml` in project root:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: buckeuchre
      POSTGRES_USER: buckeuchre
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U buckeuchre"]
      interval: 10s

volumes:
  postgres-data:
```

Start PostgreSQL:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Using Docker Run

```bash
docker run --name buckeuchre-postgres \
  -e POSTGRES_DB=buckeuchre \
  -e POSTGRES_USER=buckeuchre \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  -d postgres:16-alpine
```

## Initialize Database Schema

Once PostgreSQL is running:

```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Create initial migration and apply it
npm run prisma:migrate

# (Optional) Open Prisma Studio to inspect database
npm run prisma:studio
```

## Verify Setup

Test database connection:
```bash
cd backend
npx prisma db pull  # Should succeed without errors
```

## Troubleshooting

### Connection refused
- Ensure PostgreSQL is running: `pg_isready` or `docker ps`
- Check DATABASE_URL in `.env` has correct credentials

### Permission denied
- Ensure user has proper permissions: `GRANT ALL PRIVILEGES ON DATABASE buckeuchre TO buckeuchre;`

### Migration fails
- Check PostgreSQL logs: `docker logs buckeuchre-postgres`
- Ensure database is empty before first migration: `DROP DATABASE buckeuchre; CREATE DATABASE buckeuchre;`

## Production Setup

For production deployment, see `DEPLOYMENT.md` (to be created in Phase 9).

Key differences:
- Use strong passwords
- Use environment-specific DATABASE_URL
- Set up automated backups
- Configure connection pooling
- Use SSL/TLS for database connections
