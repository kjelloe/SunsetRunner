# 15 — AI sim campaign

Established in `marker-0015` (slice-015). The AI-only backend gate that answers
"do systems fire?" — the racer's equivalent of Fireline's sim campaign (§15.4).

## Harness (`debugging/sim_campaign.mjs`)

```
node debugging/sim_campaign.mjs [numSeats] [maxTicks]
```

Runs a field of AI drivers (`runCampaign` in `engine/sim.js`) across five pinned
seeds (1001–1005) with `rivalCollision` on, and prints a per-seed event census
(finishes / checkpoints / collisions / timeouts / end tick / hash) plus a
`systems fired` summary.

## What it answers vs not

The 5-seed gate answers **"do systems fire?"** — not "is the game balanced" (that
needs 300+ runs, §15.5). Current run (6 cars): finish ✓, checkpoint ✓, rival
collision ✓ (32/seed), timeout ✗ (nobody runs out of time on this short course).

## Finding surfaced (recorded, like Fireline's)

**The race seed is currently inert.** Traffic is seeded from
`segment.trafficSeed` (a per-segment constant), the AI is deterministic, and no
other RNG feeds the race — so all five seeds produce an identical race
(`finalHash cfcf1743…`). Consequences and the fix direction (race-seeded traffic,
or seed-varied start conditions) are noted for a balance slice. `test/
sim_campaign.test.js` pins this as a **tripwire**: if seed variation is later
wired in, that test flips and must be revisited.

## Verified

`test/sim_campaign.test.js` — the 5-seed campaign fires finish/checkpoint/
collision, each seed is internally deterministic, and the seed-inert tripwire.

## Milestone 4 status

Replay (13), AI driver (14), and the sim campaign (15) are in. Still open for a
full Milestone 4: **traffic collision** (player vs traffic — will repin
`checkpoint_1a` in both languages), a larger **sweep battery** + fairness tools
(§16), and client prediction/reconciliation (§21.2).
