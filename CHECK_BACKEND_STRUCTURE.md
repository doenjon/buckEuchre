# Check Backend File Structure

Run this on your server to see what files actually exist:

```bash
# Check what files are in the dist directory
docker compose -f docker-compose.yml exec backend ls -la /app/dist/

# Check if src directory exists
docker compose -f docker-compose.yml exec backend ls -la /app/dist/src/ 2>/dev/null || echo "dist/src/ does not exist"

# Find all index.js files
docker compose -f docker-compose.yml exec backend find /app/dist -name "index.js" -type f

# Check if backend/src exists
docker compose -f docker-compose.yml exec backend find /app/dist -type f | head -20
```

Based on the local build output, the file might be at:
- `/app/dist/backend/src/index.js` (if building from repo root)
- OR `/app/dist/src/index.js` (if building from backend directory)

