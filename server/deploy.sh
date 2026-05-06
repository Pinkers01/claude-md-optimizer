#!/usr/bin/env bash
# CLAUDE.md Optimizer · deploy to Hetzner VPS pinky-vps
# Pinky Creative Studio
#
# Usage:
#   ./deploy.sh          # rsync server + npm install + pm2 reload
#   ./deploy.sh --first  # initial install (also creates dirs, runs init-db, pm2 start)

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-pinky-vps}"
REMOTE_PATH="${REMOTE_PATH:-/srv/optimizer/server}"
REMOTE_BUILD_PATH="${REMOTE_BUILD_PATH:-/srv/optimizer/build}"
REMOTE_LANDING_PATH="${REMOTE_LANDING_PATH:-/srv/optimizer/landing}"
PM2_NAME="${PM2_NAME:-optimizer-srv}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$LOCAL_DIR/.." && pwd)"

FIRST=0
if [[ "${1:-}" == "--first" ]]; then FIRST=1; fi

echo "==> deploy from: $LOCAL_DIR"
echo "==> deploy to:   $REMOTE_HOST:$REMOTE_PATH"

if [[ $FIRST -eq 1 ]]; then
  echo "==> [first] ensuring remote dirs"
  ssh "$REMOTE_HOST" "sudo mkdir -p $REMOTE_PATH $REMOTE_BUILD_PATH $REMOTE_LANDING_PATH && sudo chown -R \$USER:\$USER /srv/optimizer"
fi

echo "==> rsync server/"
rsync -av --delete \
  --exclude 'node_modules/' \
  --exclude 'data/data.db' \
  --exclude 'data/data.db-*' \
  --exclude 'logs/' \
  --exclude '.env' \
  "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_PATH/"

if [[ -f "$LOCAL_DIR/.env" ]]; then
  echo "==> rsync .env (preserve mode)"
  rsync -av --chmod=600 "$LOCAL_DIR/.env" "$REMOTE_HOST:$REMOTE_PATH/.env"
fi

if [[ -d "$PROJECT_DIR/build" ]] && ls "$PROJECT_DIR/build/"*.zip >/dev/null 2>&1; then
  echo "==> rsync build/*.zip"
  rsync -av "$PROJECT_DIR/build/"*.zip "$REMOTE_HOST:$REMOTE_BUILD_PATH/"
fi

if [[ -d "$PROJECT_DIR/landing" ]]; then
  echo "==> rsync landing/"
  rsync -av --delete "$PROJECT_DIR/landing/" "$REMOTE_HOST:$REMOTE_LANDING_PATH/"
fi

echo "==> remote: npm install + pm2"
ssh "$REMOTE_HOST" bash -s <<EOF
set -euo pipefail
cd "$REMOTE_PATH"
npm install --omit=dev --no-audit --no-fund
mkdir -p data logs
node lib/init-db.js || true

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start index.js --name "$PM2_NAME" --time
fi
pm2 save
pm2 status "$PM2_NAME" || true
EOF

echo "==> smoke check (note: token economy — do this from your machine, not in this script)"
echo "    curl -fsS https://stopmetzoeken.store/apps/optimizer/healthz | head"
echo "==> done. Pinky checklist:"
echo "    1. Mollie API key set in $REMOTE_PATH/.env"
echo "    2. Strato SMTP password set in $REMOTE_PATH/.env"
echo "    3. nginx snippet appended (server/nginx.conf), nginx -t && reload"
echo "    4. Master Admin Apps registry will register itself within 5 minutes"
