# 66 — SSH deploy + health endpoint

Established in `marker-0089`. A guarded deploy of the working tree to the shared
Hetzner box (nginx in front, one loopback Node process), modelled on the sibling
projects' proven pattern and the box-safety howto in
`ops/sibling-project-ssh-deploy-howto.md`.

## Server changes (`server/index.js`)

- `GET /health` and `/healthz` → `200 "ok"`, served before the static allowlist —
  the deploy guard, nginx, and uptime checks use it.
- Optional host bind: `roomOpts.host` (entrypoint reads env `HOST`) — the box pins
  `127.0.0.1` (nginx is the only public face); tests/local dev omit it and bind
  all interfaces.
- `LEADERBOARD_FILE` env (alongside the existing `STATE_FILE`) so runtime state
  lives **outside** the deployed code dir — a `--delete` sync can't eat saves.

These are transport/ops only — not hashed state, no golden repin.

## Deploy tooling — tracked in `docs/`

- `docs/ssh-deploy.sh [--yes]`: allowlist rsync (`client/ shared/ engine/ server/
  data/` + `package*.json` + `LICENSE`), one SSH ControlMaster mux, a provenance
  guard (prints `branch @ sha`, stops on a dirty tree unless `--yes`), and a
  health guard (waits then curls local `/health`, then `PUBLIC_URL` if set —
  `is-active` alone lies during a crash-loop).
- `docs/deploy.env.example`: the fill-in template (DEPLOY/APP/SERVICE/PORT/
  SSH_OPTS/PUBLIC_URL).
- `docs/DEPLOYING.md`: the project playbook (systemd unit with `MemoryMax` + own
  user + `HOST=127.0.0.1` + state paths, HTTP-first certbot, WebSocket proxy).

## Security split (per user, 2026-08-05)

Anything security-relevant — real hostnames/ports, the sibling howto, and the
secret `deploy.env` — lives under `ops/`, which is **fully git-ignored**. Only
generic templates live in `docs/` and are committed. `docs/ssh-deploy.sh` sources
`ops/deploy.env`, keeping host identity out of the repo.

## Not verified / deferred

Not run against the live box from here (no host identity in this repo). Port <PORT>
is the intended claim (record in `ops/multi-game-hosting.md` on first deploy). The
neighbour curl loop + certbot lineage discipline are the howto's, not re-derived.
