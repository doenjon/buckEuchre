#!/usr/bin/env bash
set -Eeuo pipefail

cd ~/buckEuchre/
export GIT_SSH_COMMAND='ssh -i ~/.ssh/github_deploy -o IdentitiesOnly=yes'

echo "[deploy] Updating repo…"
git fetch --all --prune
git reset --hard origin/main

echo "[deploy] Building & starting…"
# Use explicit production compose file (ignore override file for local dev)
docker compose -f docker-compose.yml build --pull

echo "[deploy] Stopping and removing existing containers…"
# Force remove containers even if down fails (handles edge cases)
docker compose -f docker-compose.yml down --remove-orphans || true
# Explicitly remove containers by name if they still exist (handles containers created outside compose)
docker rm -f buckeuchre-postgres buckeuchre-backend buckeuchre-frontend buckeuchre-nginx 2>/dev/null || true

echo "[deploy] Starting services…"
docker compose -f docker-compose.yml up -d --remove-orphans --force-recreate

echo "[deploy] Waiting for services to be healthy…"
sleep 10
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose -f docker-compose.yml ps | grep -q "healthy.*backend" && docker compose -f docker-compose.yml ps | grep -q "healthy.*postgres"; then
        echo "[deploy] Services are healthy!"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo "[deploy] ⚠️  Services may not be fully healthy yet. Check with: docker compose ps"
    fi
    sleep 1
done

echo "[deploy] Done @ $(date). Commit: $(git rev-parse --short HEAD)"
