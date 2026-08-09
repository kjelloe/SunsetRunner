# Deploying Sunset Runner

Sunset Runner runs on a shared box **behind nginx**, one small Node process bound
to loopback. This is the generic playbook; every host-specific value (the real
domain, the claimed port, the SSH target) lives ONLY in gitignored `ops/`, never
in this repo. The box-wide safety rules (the five ways to take the whole box down,
certbot discipline, neighbour curl loop) are in `ops/sibling-project-ssh-deploy-howto.md`
(gitignored) — **read §1–§2 there before your first deploy.**

## What the deploy script does — `docs/ssh-deploy.sh`

`docs/ssh-deploy.sh` pushes the local working tree and restarts the service.
Modes: `--bootstrap` (one-time: user + dirs + install `sunset-runner.service`),
`--dry` (rsync dry-run, change nothing), `--yes` (skip the dirty-tree prompt).
Its four guards:

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

### 1. `ops/deploy.env` + filled configs (all gitignored)

```bash
cp docs/deploy.env.example              ops/deploy.env               # DEPLOY/APP/PORT/PUBLIC_URL
cp docs/sunset-runner.service.example   ops/sunset-runner.service    # fill <USER>/<PORT>
cp docs/sunset-runner.nginx.conf.example ops/sunset-runner.nginx.conf # fill <DOMAIN>/<PORT>
```

Claim a free loopback port and record it in the shared-box port registry (the
gitignored ops howto), then put the real value in every `ops/` file above. Only
the `.example` templates — with `<PORT>`/`<DOMAIN>` placeholders — are tracked.

### 2. Server-side: user, dir, systemd unit — `docs/ssh-deploy.sh --bootstrap`

`--bootstrap` creates the service user + `/opt/sunset-runner/state`, then installs
and enables the **filled** unit `ops/sunset-runner.service` (templated from
`docs/sunset-runner.service.example` — it pins **`HOST=127.0.0.1`**, the port,
`MemoryMax`, and state paths **outside** the code dir so `--delete` cannot eat
them). It does not start the service — deploy the code first. nginx + certbot
remain manual (next step).

### 3. nginx — HTTP-only first, then certbot adds TLS

Fill `docs/sunset-runner.nginx.conf.example` into `ops/sunset-runner.nginx.conf`,
shipped **HTTP-only** (see howto §2.3): certbot writes the TLS half. It proxies
`location /` to the loopback port and forwards the WebSocket upgrade (the game's
`ws` shares the HTTP server at the root). Install it:

```bash
sudo cp ops/sunset-runner.nginx.conf /etc/nginx/sites-available/sunset-runner
sudo ln -s /etc/nginx/sites-available/sunset-runner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx      # single command — the && is the safety
# Extend the SHARED lineage; never mint a subset (howto §4b.5):
sudo certbot certificates                          # read the current name set first
sudo certbot certonly --nginx --cert-name <existing-lineage> -d <every-existing> -d <your-domain>
sudo systemctl reload nginx
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
- [ ] `sudo ss -ltnp 'sport = :<PORT>'` shows **127.0.0.1** only
- [ ] `systemctl status sunset-runner` active; `/health` returns 200
- [ ] Port recorded in the shared-box registry; game added to the games index
