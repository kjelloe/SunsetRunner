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

### Multiplayer robustness (post-plan, from the Pitfall write-up)

- [x] drop-in / reconnect: seats survive drops (grace + token reclaim, supersede),
      client reconnect backoff + reconnect-on-visible, never-strand (marker-0034)
- [ ] server-restart persistence (serialize session to disk; lossless deploys — Pitfall #4)
- [ ] screen wake lock; browser-level strand test

### Playtest polish (from real playtests)

- [x] renderer speed/scroll + rumble strips + scenery (marker-0030)
- [x] finish celebration (confetti/fireworks) + mobile arrow pad (marker-0031)
- [x] driving feel: crash stun + cornering that matters (marker-0032)
- [x] traffic/scenery visible + car drift readable (marker-0033)
- [x] scenery/traffic follow the road curve (marker-0035)
- [x] hills (visible crests/dips) + a fork on the default course (marker-0036)
- [ ] native visual/perf tuning (camera magnitudes, CURVE_PUSH_DEN, HILL_SCALE, high-DPR); music

## Milestone 4 — Collision, traffic, AI

- [x] slice-013 replay-dump-load  *(room dumps a re-runnable scenario)*
- [x] slice-014 ai-driver  *(deterministic hold-lane AI + AI race runner)*
- [x] slice-015 sim-campaign  *(5-seed "do systems fire?" gate)*
- [x] traffic collision (player vs traffic; always-on crash; repinned goldens both langs)

**Milestone 4 (collision, traffic, AI): COMPLETE.**

## Milestone 5 — Content and feel

- [x] hills — visible crests/dips, all courses (marker-0036)
- [x] branching forks (marker-0021) — course 2 canyon_split, forkChoice command, Luau-twinned
- [x] fork on the DEFAULT course (marker-0036) — sunset_coast 1→2(cp)→3(fork)→{4|5}→6
- [x] client fork UI (Q/E + ?course select, local+remote) (marker-0022)
- [x] curve physics (centrifugal push, truncDiv-symmetric) (marker-0023)
- [x] route-mirror fairness (§16.1) — mirror_valley course + mirrorFairness (marker-0023)
- [x] seat/lane-skew: same-tick-tie fix + symmetric AI dodge (marker-0024)
- [x] traffic-swap fairness (§16.3) — trafficSwapFairness (marker-0027)
- [x] client prediction/reconciliation (§21.2) — predict local car + replay (marker-0028)
- [ ] residual traffic/course lean pass; music; native visual/perf tuning
- [ ] slice-016 client-smoke
- [x] slice-017 mobile-touch-controls  *(on-screen touch + fork buttons, synthetic-pointer tested)*
- [x] slice-018 asset-strip-pipeline  *(procedural sprite manifest + width-pin + sprite renderer)*
- [ ] music select; native visual/perf tuning (§17)

## Luau twin (batched — after Milestone 1 lands)

- [x] spine twin seam (prng/fixedmath/canonical/statehash/constants) + parity gate
- [x] slice-019 roblox engine twin (state, car_physics, road_progress, traffic,
      copy_state, snapshot, reducer, scenario + loaders) — reproduces
      `checkpoint_1a` byte-identically via lune (marker-0008)

## Harness (grown as the feature it tests arrives)

- [x] node --test unit gates + golden fixtures + `test.sh` self-test
- [x] scenario replay (`engine/scenario.js`) + `checkpoint_1a` + repin tool + `debugging/replay.mjs`
- [ ] sim campaign (`debugging/sim_campaign_outrun.sh`) — with AI drivers
- [x] race-seeded traffic (marker-0017) — seeds now vary the race
- [x] sweep battery (`tools/sim_sweep.mjs`) + fairness (seat-order, car-swap) (marker-0018)
- [ ] route-mirror fairness (needs forks), analyze_sweep.py, seat/lane-skew fix
- [ ] Playwright client smoke / ui-acceptance / perf smoke
