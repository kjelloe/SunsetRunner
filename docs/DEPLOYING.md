# Deploying Sunset Runner

Sunset Runner runs on the shared Hetzner box **behind nginx**, one small Node
process bound to loopback. This is the project-specific playbook; the box-wide
safety rules (the five ways to take the whole box down, certbot discipline,
neighbour curl loop) are in [`sibling-project-ssh-deploy-howto.md`](sibling-project-ssh-deploy-howto.md)
— **read §1–§2 there before your first deploy.**

## What the deploy script does — `docs/ssh-deploy.sh`

`docs/ssh-deploy.sh [--yes]` pushes the local working tree and restarts the
service. Its four guards:

- **Allowlist sync.** Only `client/ shared/ engine/ server/ data/` + `package*.json`
  + `LICENSE` ship. Everything else (`.claude`, `test/`, `tools/`, `debugging/`,
  `specs/`, `ops/`, `*.md`, `.state/`) stays local — an exclude list fails open.
- **One SSH mux** (ControlMaster) — a single auth for the whole run.
- **Provenance guard** — prints `branch @ sha`, and stops if the tree is dirty
  unless you pass `--yes`.
- **Health guard** — after `systemctl restart` it waits and curls
  `http://127.0.0.1:$PORT/health`, then (if `PUBLIC_URL` is set) the public URL.
  `is-active` alone lies during a crash-loop; the health tail does not.

`--delete` keeps the box tree identical to the allowlist. Runtime state lives in
`$APP/state` (beside the code, not under it), so `--delete` never sees it.

## First-time setup

### 1. `ops/deploy.env`

```bash
cp docs/deploy.env.example ops/deploy.env   # gitignored — fill in DEPLOY/APP/PORT/PUBLIC_URL
```

Claim the next free port (**<PORT>** at time of writing) and record it in
`ops/multi-game-hosting.md` per the howto §3.

### 2. Server-side: user, dir, systemd unit

Create a dedicated user + `/opt/sunset-runner`, then this unit
(`/etc/systemd/system/sunset-runner.service`). Note **`HOST=127.0.0.1`** (nginx
is the only public face) and the state paths **outside** the code dir:

```ini
[Unit]
Description=Sunset Runner
After=network.target

[Service]
User=sunset
WorkingDirectory=/opt/sunset-runner
Environment=PORT=<PORT>
Environment=HOST=127.0.0.1
Environment=STATE_FILE=/opt/sunset-runner/state/session.json
Environment=LEADERBOARD_FILE=/opt/sunset-runner/state/leaderboard.json
ExecStart=/usr/bin/node /opt/sunset-runner/server/index.js
Restart=on-failure
RestartSec=5

MemoryMax=512M
CPUQuota=50%
TasksMax=256

ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true
ReadWritePaths=/opt/sunset-runner/state

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable sunset-runner
```

### 3. nginx — HTTP-only first, then certbot adds TLS

Ship the server block **HTTP-only** (see howto §2.3), reverse-proxying to the
loopback port, with the shared WebSocket upgrade map. Then:

```bash
sudo nginx -t && sudo systemctl reload nginx      # single command — the && is the safety
sudo certbot certonly --nginx --cert-name <existing-lineage> -d <every-existing> -d <your-domain>
sudo systemctl reload nginx
```

The proxy must forward the WebSocket upgrade (the game is `ws`):

```nginx
location / {
    proxy_pass http://127.0.0.1:<PORT>;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;   # reference, never redefine the map
    proxy_set_header Host $host;
}
```

### 4. Deploy

```bash
./docs/ssh-deploy.sh          # confirms if the tree is dirty
./docs/ssh-deploy.sh --yes    # non-interactive (clean tree)
```

## Health & state

- `GET /health` (and `/healthz`) → `200 ok`. Used by the deploy guard, nginx, and
  any uptime check.
- The server binds `HOST` if set (loopback on the box), else all interfaces
  (local dev / tests).
- `STATE_FILE` / `LEADERBOARD_FILE` env override the default `.state/` paths so
  the box keeps runtime state in `/opt/sunset-runner/state`, safe from `--delete`.

## When it breaks

Follow the howto §7 recovery order. In short: a bad nginx config never reloads
(the running one is untouched — `sudo nginx -t` reads the line number); disable
just your site with `rm /etc/nginx/sites-enabled/sunset-runner` + the reload
one-liner; `sudo systemctl stop sunset-runner` if the process misbehaves. Always
`.bak` an nginx file before editing it, and run the neighbour curl loop after any
certificate operation.

## Post-flight

- [ ] `https://<your-domain>/health` → `200 ok`
- [ ] Every neighbour still answers (howto §2 curl loop)
- [ ] `sudo ss -ltnp | grep :<PORT>` shows **127.0.0.1** only
- [ ] `systemctl status sunset-runner` active; `/health` returns 200
- [ ] Port recorded in `ops/multi-game-hosting.md`; game added to the games index
