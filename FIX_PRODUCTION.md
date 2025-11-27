# Fix Production Deployment Issues

## Current Issues

1. Frontend running dev server (should be production nginx)
2. Backend container not visible/not running
3. Nginx can't find backend upstream

## Commands to Run on Server

```bash
# 1. Stop everything
docker compose down

# 2. Check if override file exists and remove/rename it
ls -la docker-compose.override.yml
mv docker-compose.override.yml docker-compose.override.yml.disabled

# 3. Start with explicit production config
docker compose -f docker-compose.yml up -d

# 4. Check all containers are running
docker compose -f docker-compose.yml ps

# 5. Check backend is running
docker compose -f docker-compose.yml logs --tail=50 backend

# 6. Check frontend is running (should be nginx, not Vite)
docker compose -f docker-compose.yml logs --tail=50 frontend

# 7. Check nginx logs
docker compose -f docker-compose.yml logs --tail=50 nginx
```

## Expected Results

After fixing:
- **Backend**: Running on port 3000 (healthy)
- **Frontend**: Nginx serving static files on port 80 (healthy)
- **Nginx**: Reverse proxy connecting to frontend and backend (healthy)
- **Postgres**: Running and healthy

## If Backend Still Not Starting

```bash
# Check backend logs for errors
docker compose -f docker-compose.yml logs backend

# Check if backend container exists
docker compose -f docker-compose.yml ps | grep backend

# Manually start backend if needed
docker compose -f docker-compose.yml up -d backend
```



