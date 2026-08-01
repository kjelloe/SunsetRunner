# 17 — Race-seeded traffic

Established in `marker-0017`. Resolves the finding from the sim campaign
(specs/15): the race seed was inert. Traffic is now seeded from **segment seed +
race seed**, so different race seeds produce different traffic — the basis for
balance sweeps (§16) — while staying segment-stable within a race.

## Change

`engine/traffic.js` (and `luau/traffic.luau`): `spawnSegmentTraffic` seeds its
PRNG with `(segment.trafficSeed + state.seed) mod 2^32` instead of
`segment.trafficSeed` alone. Still deterministic and per-segment stable; now also
race-varying. Nothing else about spawning changed.

## Golden repins (conscious)

Every traffic-bearing golden shifted (traffic positions are hashed):
- `physics_1a` / `checkpoint_1a` (seed 12345 accel-only): finish moves 404 → **266**
  for this seed's traffic layout; `checkpoint_1a finalHash 18d3231cfe065ab3`.
- `collision_1a`: hashes changed (traffic differs), census unchanged
  (`de2c16e61a6abd81`).
- AI solo golden: finish **339**, `fef5f12dc746ecba`.
All re-verified in Luau (both engine gates green).

## Tripwire flipped

The `sim_campaign` "race seed is inert" test is replaced by
"race seed varies the outcome" — different seeds now yield different final hashes.

## Verified

`./test.sh` → 95/95 + 3 Luau gates. Unblocks the sweep battery (marker-0018).
