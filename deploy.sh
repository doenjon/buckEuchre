#!/usr/bin/env bash
set -Eeuo pipefail

export GIT_SSH_COMMAND='ssh -i ~/.ssh/github_deploy -o IdentitiesOnly=yes'

echo "[deploy] Updating repo…"
git fetch --all --prune
git reset --hard origin/main

echo "[deploy] Building & starting…"
docker compose build --pull
docker compose up -d --remove-orphans

echo "[deploy] Done @ $(date). Commit: $(git rev-parse --short HEAD)"
