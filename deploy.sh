#!/usr/bin/env bash
set -Eeuo pipefail

cd ~/buckEuchre/
export GIT_SSH_COMMAND='ssh -i ~/.ssh/github_deploy -o IdentitiesOnly=yes'

echo "[deploy] Updating repo…"
git fetch --all --prune
git reset --hard origin/main

echo "[deploy] Building & starting…"
docker compose build --pull
docker compose down --remove-orphans || true
docker compose up -d --remove-orphans

echo "[deploy] Waiting for services to be healthy…"
sleep 10
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose ps | grep -q "healthy.*backend" && docker compose ps | grep -q "healthy.*postgres"; then
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
