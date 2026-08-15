---
name: slice
description: Deliver a Sunset Runner gameplay/engine slice end to end — design → tests → code → docs/specs sync → marker-NNNN commit on dev_night. Use when implementing any slice from plan-implementation-order.md or a new mechanic.
---

# Sunset Runner slice workflow

One slice = one `marker-NNNN` commit on `dev_night`. Keep determinism sacred.

## 1. Scope from the plan
- Find the next slice in `plan-implementation-order.md`. Read the matching
  section of `specs/game-design.md` (the brief) and any numbered `specs/NN-*.md`.
- Check how Fireline / RetroMultiCiv already solved it (see the
  `reference-sibling-repos` memory) before inventing.

## 2. Honour the determinism contract (`specs/01`)
- No floats in `shared/`/`engine/`. Integer fixed-point (`shared/constants.js`),
  `truncDivI32` for symmetric quantities. No `Math.random`/`Date.now`/wall-clock.
- Reducer is pure `apply(state, command)`; keep the pinned tick order.
- New hashed state field → update `shared/statehash.js` and repin fixtures
  (a conscious act, logged in `dev-log.md`).

## 3. Tests first where practical
- `node --test` suites in `test/`. Pin golden vectors/hashes in `test/fixtures/`.
- Content that ships (course data, asset manifests) gets a content-drift hash pin.
- Run `./test.sh` (JS suite + `lune` parity) — must be green.

## 4. Sync the records (every slice)
- `dev-log.md`: append a `marker-NNNN` entry (goal, built, gate, next).
- `plan-implementation-order.md`: flip the slice to `[x]`.
- `specs/NN-*.md`: add/append the spec for any new subsystem or decision.
- README structure list if a new dir/module appeared.
- Memories (`~/.claude/projects/-mnt-c-GIT-outrunmulti/memory/`): update
  `project-sunset-runner` build-state + MEMORY.md when the marker/next changes.

## 5. Commit + push
- Stage specific files. Commit with `marker-NNNN — <slice> — <summary>` and the
  Co-Authored-By trailer. Commit + push are granted on `dev_night` only.
- If no git remote exists yet, commit locally and tell the user push is pending
  a remote.

## Presentation slices (browser renderer + Roblox host)
Most playtest fixes are **presentation-only** and must NOT touch the determinism
contract — the browser Canvas renderer (`client/*.js`) and the Roblox host
(`roblox/src/`) render what the shared engine returns.
- No engine/`shared`/`luau` change → **no repin**; goldens + lune gates are untouched.
  `math.random` / floats / wall-clock are fine HERE, never in `shared`/`engine`/`luau`.
- Roblox: run `rojo build roblox/default.project.json -o /tmp/x.rbxl` as a syntax gate
  (it does NOT type-check). I can't run Studio — the user playtests via screenshots.
  Read `roblox/roblox-howto-and-gotchas.md` first (2048 Part.Size cap, coplanar
  z-fight, SurfaceGui-renders-on-transparent-part, Roblox lazy-defers big static
  distant parts, ViewportFrame lighting, WedgePart/Cylinder orientation, …).
- Browser: `npm test` + `npm run test:browser` (Playwright smoke) must stay green.
  Client-defined sprites/art kept OUT of `data/assets.json` avoid a content-hash repin.
- If a playtest fix genuinely needs an engine tune (e.g. slimming `CAR_WIDTH`), it IS a
  conscious repin: change JS + the Luau twin, repin only the goldens that move, re-run
  the 6 lune gates, log it. Record playtest rounds in `specs/78` (Roblox) / `specs/79`
  (browser), not a new spec per marker.

## Deferred
- Luau twin of engine modules is BATCHED after Milestone 1 (not per-slice). The
  spine twin seam + `luau/spine-check.luau` parity gate already exist.
