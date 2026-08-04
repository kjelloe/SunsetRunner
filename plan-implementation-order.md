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
- [x] server-restart persistence — serialize + restore, deploy handoff (marker-0037)
- [x] screen wake lock + high-DPR canvas buffer (marker-0038)
- [x] reconnect UI: connection status + banner (marker-0039)
- [ ] browser-level strand test (#7); dedicated rejoin button

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
- [x] route-mirror fairness (needs forks), analyze_sweep.py, seat/lane-skew fix (marker-0040)
- [x] slice-040 car roster (4 cars) + balance sweep + analyze_sweep.py (marker-0040)
- [x] slice-041 car-select UI (pre-race picker, ?car=N) (marker-0041)
- [x] slice-042 procedural audio (engine hum + SFX + chiptune) (marker-0042)
- [x] slice-043 ws server hardening (payload cap + rate limit) (marker-0043)
- [x] slice-044 per-leg scenery themes (beach/canyon/forest) (marker-0044)
- [x] slice-045 car identity on ghosts (tint by carId) (marker-0045)
- [x] slice-046 live feel-tuning knobs (?tune=1 + URL overrides) (marker-0046)
- [ ] Playwright client smoke / ui-acceptance / perf smoke

## Milestone 6 — Full course + race framing (from playtest, 2026-08-03)

- [x] slice-047 tighten feel-knob ranges (marker-0047)
- [x] slice-048 forks by lane position (marker-0048)
- [x] slice-049 race countdown 3-2-1-GO! (marker-0049)
- [x] slice-050 fork preview (name branches + arrows) (marker-0050)
- [x] slice-051 big centre race timer (marker-0051)
- [x] slice-052 splash screen + client asset loading bar (marker-0052)
- [x] slice-053 difficulty EASY/MEDIUM/HARD select + difficulty.timeScale (local) (marker-0053)
- [x] slice-054 checkpoints after each segment (grand_tour, ~90% refill) (marker-0054)
- [x] slice-054 course-authoring: loader nameKey/seconds (not hashed) (marker-0054)
- [x] slice-054 tools/build_course.mjs (seconds->stripCount, validate, report) (marker-0054)
- [x] slice-054 grand_tour: 55 segs, 6 biomes, 3 forks (?course=4) + content repin (marker-0054)
- [x] slice-055 race summary + restart (local) (marker-0055)
- [x] slice-059 server race framing: shared countdown + first-joiner difficulty (marker-0059)
- [x] slice-060 grand_tour 10 terrains + no-straight rule (marker-0060)
- [x] slice-061 checkpoint banners (marker-0061)
- [x] slice-062 hills 320 + per-terrain road width (marker-0062)
- [x] slice-063 side terrain (water) + road sheen (marker-0063)
- [x] slice-064 fir + wheat sprites (marker-0064)
- [x] slice-065 default course 4 + visible road fork (marker-0065)
- [x] slice-066 cross-hazards (snowmobiles/skiers), state v2, Luau-twinned (marker-0066)
- [x] slice-067 balanced course elements + downhill + checkpoint horizon (marker-0067)
- [x] slice-068 snowmobile/skier sprites (marker-0068)
- [x] slice-069 HUD big speed + stage indicator (marker-0069)
- [x] slice-070 car-select side-profile picture (marker-0070)
- [x] slice-071 stage durations 60-240s ramp + entry announcement (marker-0071)
- [x] slice-072 more traffic (bus/motorcycle, density 6) (marker-0072)
- [x] slice-073 MP name tags + horizon dots (marker-0073)
- [x] slice-076 real player names (name entry + JOIN name + ghost tags) (marker-0076)
- [x] slice-077 MP time-up Re-join / Spectate (marker-0077)
- [ ] points / scoreboard system (for re-join-from-stage scoring)
- [ ] server-side spectate target feed (traffic around spectated car)
- [ ] time-up UI: Re-join / Spectate (cycle players, name centre-bottom) + points
- [ ] server-authoritative countdown for multiplayer
