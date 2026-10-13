#!/usr/bin/env bash
# Deploy to production from your local machine in one command:
#   ./deploy-prod.sh
#
# Pushes local main to origin, then runs deploy.sh on the EC2 server
# (git pull + docker compose rebuild) and checks the live URLs.
# Override defaults with env vars, e.g. SSH_KEY=~/keys/whatomate.pem ./deploy-prod.sh
set -euo pipefail

cd "$(dirname "$0")"

SSH_KEY="${SSH_KEY:-./whatomate.pem}"
SSH_HOST="${SSH_HOST:-ubuntu@13.207.191.48}"
REMOTE_DIR="${REMOTE_DIR:-~/3m-whatsapp}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY"
  exit 1
fi
chmod 400 "$SSH_KEY"

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "Not on main — switch to main before deploying."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "You have uncommitted changes — commit or stash them first."
  exit 1
fi

echo "==> Pushing main to origin"
git push origin main

echo "==> Deploying on $SSH_HOST"
ssh -i "$SSH_KEY" "$SSH_HOST" "cd $REMOTE_DIR && git pull --ff-only origin main && ./deploy.sh"

echo "==> Health check"
sleep 10
curl -s -o /dev/null -w "frontend  https://3m-app.chatsguru.co  -> %{http_code}\n" https://3m-app.chatsguru.co/
curl -s -o /dev/null -w "backend   https://3m-api.chatsguru.co  -> %{http_code} (404 at / is normal)\n" https://3m-api.chatsguru.co/
