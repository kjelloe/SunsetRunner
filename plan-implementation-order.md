# Implementation order — Sunset Runner

Slice roadmap from `specs/game-design.md` §22. One slice ≈ one `marker-NNNN`
commit (see `dev-log.md`). Milestones from §23.

Status: `[x]` done · `[~]` in progress · `[ ]` not started.

## Milestone 1 — Solo checkpoint run (browser)

- [x] slice-001 project-skeleton
- [x] slice-002 prng-fixed-hash  *(spine + first golden fixture)*
- [x] slice-003 road-data-loader  *(sunset_coast course + validation)*
- [ ] slice-004 single-car-physics
- [ ] slice-005 canvas-road-renderer
- [ ] slice-006 checkpoint-timer
- [ ] slice-007 traffic-spawn
- [ ] slice-008 local-race-loop  *(+ `checkpoint_1a` golden hash fixture)*

## Milestone 2 — Server room

- [ ] slice-009 node-ws-room
- [ ] slice-010 remote-session-seam

## Milestone 3 — 8-player ghost race

- [ ] slice-011 ghost-players
- [ ] slice-012 same-segment-collision

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
- [ ] slice-019 roblox engine twin (car_physics, road_progress, timer, forks,
      traffic, collision, reducer) — port order per §20, same JSON scenarios as
      cross-language contracts

## Harness (grown as the feature it tests arrives)

- [x] node --test unit gates + golden fixtures + `test.sh` self-test
- [ ] sim campaign (`debugging/sim_campaign_outrun.sh`) — with AI drivers
- [ ] sweep battery (`tools/sim_sweep.mjs`) + fairness tools (mirror/carswap/traffic)
- [ ] Playwright client smoke / ui-acceptance / perf smoke
