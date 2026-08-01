# 24 — Same-tick finish ties (seat-fairness fix)

Established in `marker-0024`. Investigates and fixes the seat/left-lane skew
recorded in specs/18 (seat 1 won ~29/40). No engine hash change — a
sim/measurement fix — so no golden repin.

## Diagnosis

With traffic removed, two identical cars at mirror-symmetric start lanes finish
the **same tick every seed** (215/215) — a genuine dead heat. But `runAiRace`
picked the winner as `census.finishes[0]` (the first finish EVENT), which is
emitted in seat-array order → always the lowest seatId. So every tie was silently
awarded to seat 1 (§24: "same-tick finish ties must have explicit rules").

## Fix

- `engine/sim.js` — winner = the seat with the earliest finish tick; if several
  share it, `winnerSeat = -1` and `tie = true` (an explicit dead heat, awarded to
  nobody).
- `engine/fairness.js` `seatOrderFairness` returns `{ decisive, ties, wins }` —
  ties are counted, not credited to a seat.
- `engine/ai_driver.js` — the dodge is now SYMMETRIC: traffic to the right →
  steer left, to the left → steer right, dead-ahead → toward centre. (The old
  `>=` always dodged left. A no-op on the current goldens, but removes a
  latent AI-side bias.)

## Residual (recorded, not a bug)

After the tie fix, a residual lean remains among *decisive* traffic races
(~26/12). This is a property of course-1 geometry + traffic on the fixed ±128
start lanes and the AI — **not engine unfairness**: the engine is proven
symmetric by the route-mirror-fairness test (specs/23). The test asserts only
non-monopoly, and records this explicitly.

## Verified

`test/fairness.test.js` — no-traffic races are all TIES with an empty win table
(the exact bug, now fixed); with-traffic non-monopoly; sweep winner-or-tie
invariant. `test/ai_driver.test.js` — symmetric dodge both ways. `./test.sh` →
114/114 + 4 Luau gates.

## Open

The residual traffic/course lean and traffic-swap fairness (§16.3) remain for a
later balance pass; a fairer start-lane assignment (or standings tie rule) could
also be revisited.
