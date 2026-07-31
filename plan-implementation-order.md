# Implementation order — Sunset Runner

Slice roadmap from `specs/game-design.md` §22. One slice ≈ one `marker-NNNN`
commit (see `dev-log.md`). Milestones from §23.

Status: `[x]` done · `[~]` in progress · `[ ]` not started.

## Milestone 1 — Solo checkpoint run (browser)

- [x] slice-001 project-skeleton
- [x] slice-002 prng-fixed-hash  *(spine + first golden fixture)*
- [x] slice-003 road-data-loader  *(sunset_coast course + validation)*
- [x] slice-004 single-car-physics  *(engine state + pure reducer + snapshot hash)*
- [x] slice-005 canvas-road-renderer  *(client: pseudo-3D road + car + HUD + local session)*
- [x] slice-006 checkpoint-timer  *(timer + checkpoint bonus + timeout; repinned physics golden)*
- [x] slice-007 traffic-spawn  *(deterministic segment-seeded traffic; repinned golden)*
- [x] slice-008 local-race-loop  *(scenario replay + `checkpoint_1a` golden + repin tool)*

**Milestone 1 (solo checkpoint run): COMPLETE.**

## Milestone 2 — Server room

- [x] slice-009 node-ws-room  *(http static + ws room, protocol, per-seat views)*
- [x] slice-010 remote-session-seam  *(interchangeable local/remote client seam)*

**Milestone 2 (server room): COMPLETE.**

## Milestone 3 — 8-player ghost race

- [x] slice-011 ghost-players  *(filtered ghost views + collisionActive + standings)*
- [x] slice-012 same-segment-collision  *(gated rival bump + collision_1a golden + Luau twin)*

**Milestone 3 (8-player ghost race): COMPLETE.**

## Milestone 4 — Collision, traffic, AI

- [ ] slice-013 replay-dump-load
- [ ] slice-014 ai-driver
- [ ] slice-015 sim-campaign

## Milestone 5 — Content and feel

- [ ] slice-016 client-smoke
- [ ] slice-017 mobile-touch-controls
- [ ] slice-018 asset-strip-pipeline

## Luau twin (batched — after Milestone 1 lands)

- [x] spine twin seam (prng/fixedmath/canonical/statehash/constants) + parity gate
- [x] slice-019 roblox engine twin (state, car_physics, road_progress, traffic,
      copy_state, snapshot, reducer, scenario + loaders) — reproduces
      `checkpoint_1a` byte-identically via lune (marker-0008)

## Harness (grown as the feature it tests arrives)

- [x] node --test unit gates + golden fixtures + `test.sh` self-test
- [x] scenario replay (`engine/scenario.js`) + `checkpoint_1a` + repin tool + `debugging/replay.mjs`
- [ ] sim campaign (`debugging/sim_campaign_outrun.sh`) — with AI drivers
- [ ] sweep battery (`tools/sim_sweep.mjs`) + fairness tools (mirror/carswap/traffic)
- [ ] Playwright client smoke / ui-acceptance / perf smoke
