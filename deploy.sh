#!/usr/bin/env bash
# Deploy from repo root on EC2.
# Always pass --env-file so compose can interpolate ${POSTGRES_PASSWORD}, etc.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="./backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it before deploying."
  exit 1
fi

git fetch origin main
git pull origin main

docker image prune -f || true

docker compose --env-file "$ENV_FILE" up -d --build --force-recreate

docker compose --env-file "$ENV_FILE" ps
