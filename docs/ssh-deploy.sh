#!/bin/bash
# docs/ssh-deploy.sh — push the local working tree to the shared Hetzner box and
# restart the service, without breaking the neighbours. The reasoning behind
# every guard is in docs/DEPLOYING.md and ops/sibling-project-ssh-deploy-howto.md.
#
# ALLOWLIST deploy: only what the server RUNS is synced (client/shared/engine/
# server/data + package files + LICENSE). Dev/agent/internal files (.claude,
# test/, tools/, debugging/, specs/, ops/, *.md, .state/) never leave this
# machine. Runtime state (session.json, leaderboard.json) lives OUTSIDE the
# deployed code on the box and is never touched by the sync.
#
# Host identity is NOT in the repo: ops/deploy.env (gitignored) defines DEPLOY,
# APP, SSH_OPTS, SERVICE, PUBLIC_URL, PORT — template in docs/deploy.env.example.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="ops/deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found — copy docs/deploy.env.example and fill it in."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${DEPLOY:?deploy.env must set DEPLOY (user@host)}" "${APP:?deploy.env must set APP (/opt/...)}"
# Real host/port/domain come from ops/deploy.env (gitignored); this default is a
# harmless dev fallback, never the box's actual port.
: "${SERVICE:=sunset-runner}" "${SSH_OPTS:=}" "${PUBLIC_URL:=}" "${PORT:=8000}"

SSH="ssh $SSH_OPTS"
SSH_SHOW="$SSH"
# One SSH connection for the whole deploy (mux): one prompt, reused by ssh + rsync.
MUX_SOCK="${TMPDIR:-/tmp}/sunset-deploy-%r@%h:%p"
SSH="$SSH -o ControlMaster=auto -o ControlPath=$MUX_SOCK -o ControlPersist=300 -o ServerAliveInterval=30 -o ServerAliveCountMax=6"
cleanup_mux() { ssh -O exit -o ControlPath="$MUX_SOCK" "$DEPLOY" 2>/dev/null || true; }
trap cleanup_mux EXIT

# Modes:
#   --bootstrap  one-time server setup: user, /opt dir + state/, install the
#                systemd unit (docs/sunset-runner.service). nginx + certbot stay
#                manual — see docs/DEPLOYING.md §3.
#   --dry        rsync --dry-run: show what WOULD sync, change nothing.
#   --yes        skip the dirty-tree confirmation (clean-tree / CI redeploys).
MODE="${1:-}"

if [ "$MODE" = "--bootstrap" ]; then
  echo "==> Bootstrap: user '${SVC_USER:=sunset}', $APP + state/, systemd unit $SERVICE"
  $SSH "$DEPLOY" "sudo useradd --system --home $APP --shell /usr/sbin/nologin $SVC_USER 2>/dev/null || true
    sudo mkdir -p $APP/state && sudo chown -R $SVC_USER:$SVC_USER $APP"
  # The FILLED unit lives in gitignored ops/ (real port/user), templated from
  # docs/sunset-runner.service.example. It never ships to GitHub.
  UNIT="ops/sunset-runner.service"
  [ -f "$UNIT" ] || { echo "ERROR: $UNIT not found — fill docs/sunset-runner.service.example into ops/"; exit 1; }
  # shellcheck disable=SC2086
  scp $SSH_OPTS -o ControlPath="$MUX_SOCK" "$UNIT" "$DEPLOY:/tmp/$SERVICE.service"
  $SSH "$DEPLOY" "sudo mv /tmp/$SERVICE.service /etc/systemd/system/$SERVICE.service
    sudo systemctl daemon-reload && sudo systemctl enable $SERVICE"
  echo "    unit installed + enabled (NOT started — deploy code first)."
  echo "    NEXT by hand: nginx block (ops/sunset-runner.nginx.conf) + certbot — DEPLOYING.md §3."
  exit 0
fi

# Provenance guard: this deploys the WORKING TREE. Say what becomes public and
# stop for confirmation when it is not a clean commit.
YES=0; [ "$MODE" = "--yes" ] && YES=1
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SHA=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain | grep -vc '^??' || true)
echo "==> Deploying working tree: $BRANCH @ $SHA -> $DEPLOY:$APP (port $PORT)"
if [ "${DIRTY:-0}" -gt 0 ] && [ "$YES" -eq 0 ]; then
  echo "    !! $DIRTY uncommitted tracked change(s) — they WILL be published"
  read -r -p "    Continue anyway? [y/N] " REPLY
  case "$REPLY" in y|Y|yes|YES) ;; *) echo "    aborted — nothing was sent"; exit 1 ;; esac
fi

echo "==> Ensuring $APP + its state dir exist and are owned by the deploy user"
$SSH "$DEPLOY" "sudo mkdir -p $APP/state && sudo chown -R \$(id -un):\$(id -gn) $APP"

# Shared-box sanity BEFORE the restart — a bad neighbour is visible while the old
# process still serves (nginx validity, port ownership, headroom).
echo "==> Shared-box sanity"
$SSH "$DEPLOY" "
  if command -v nginx >/dev/null 2>&1 && ! sudo nginx -t 2>/dev/null; then
    echo '    !! nginx -t FAILS — the next reload would drop EVERY site on this box'
  fi
  # ss's own sport filter, not grep -w: a colon preceded by a digit
  # (127.0.0.1:$PORT) breaks grep's word boundary, so -w silently never matches.
  owner=\$(sudo ss -ltnpH \"sport = :$PORT\" 2>/dev/null | grep -oE 'users:\(\(\"[^\"]+' | head -1 | cut -d'\"' -f2)
  if [ -n \"\$owner\" ] && [ \"\$owner\" != 'node' ]; then
    echo \"    !! port $PORT is held by '\$owner', not node — a neighbour may have taken it\"
  fi
  df -h / | awk 'NR==2 && \$5+0 > 90 { print \"    !! disk \" \$5 \" full — state writes will fail\" }'
  free -m | awk '/^Mem:/ { if (\$7 < 200) print \"    !! only \" \$7 \"MB available — OOM risk\" }'
"

DRY=""; [ "$MODE" = "--dry" ] && DRY="--dry-run" && echo "==> DRY RUN — nothing will change"
echo "==> Syncing runtime code to $DEPLOY:$APP (allowlist)"
rsync -av $DRY --delete --no-owner --no-group \
    --include '/client/***' \
    --include '/shared/***' \
    --include '/engine/***' \
    --include '/server/***' \
    --include '/data/***' \
    --include '/package.json' \
    --include '/package-lock.json' \
    --include '/LICENSE' \
    --exclude '*' \
    -e "$SSH" \
    ./ "$DEPLOY:$APP/"
# --delete keeps the box tree === the allowlist, but state/ is not in the include
# set so --delete never sees it (it lives beside the code, not under it).
[ -n "$DRY" ] && { echo "==> DRY RUN complete — no restart."; exit 0; }

echo "==> Installing deps + restarting $SERVICE"
$SSH "$DEPLOY" \
    "if ! command -v npm >/dev/null 2>&1; then \
       echo 'ERROR: npm not found — Node is not installed (see docs/DEPLOYING.md).'; exit 1; \
     fi && \
     cd $APP && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev) && \
     sudo systemctl restart $SERVICE && \
     sleep 3 && \
     systemctl is-active $SERVICE && \
     curl -fsS http://127.0.0.1:$PORT/health >/dev/null && echo '    local /health OK'"
# The sleep+health tail is the DEPLOY GUARD: restart + is-active alone can report
# success while the unit crash-loops. A dead listener fails loudly here.

if [ -n "$PUBLIC_URL" ]; then
  echo "==> Verifying the PUBLIC endpoint ($PUBLIC_URL)"
  if ! curl -fsS --max-time 15 "$PUBLIC_URL/health" >/dev/null; then
    echo "ERROR: public endpoint did not answer though the local port did —"
    echo "       that means nginx or TLS, not the game (see docs/DEPLOYING.md §7)."
    exit 1
  fi
  echo "    public /health OK"
fi

echo "==> Deployed + verified serving."
echo "    Logs: $SSH_SHOW $DEPLOY 'journalctl -u $SERVICE -f'"
