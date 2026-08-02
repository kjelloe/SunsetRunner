# 38 — Car roster + balance sweep

Established in `marker-0040`. Grows the roster to four distinct cars and adds the
data loop that keeps them balanced. Backend + content only — no engine change,
no golden repin.

## Roster (`data/cars.json`)

| id | name | profile |
|----|------|---------|
| 1 | red_sprint | reference car (every golden races it — **never retune**) |
| 2 | blue_bolt | high acceleration, modest top speed |
| 3 | green_machine | high top speed, weak acceleration — glass cannon |
| 4 | gold_glider | best steering + brakes, nimble all-rounder |

Car 1 is the pinned reference: its stats feed checkpoint_1a / collision_1a /
fork_1a / physics_1a / AI goldens and the Luau parity gates. Balance the *others*
around it; touching car 1 cascades a full repin + reparity for a cosmetic nudge.

## Sweep (`tools/sim_sweep.mjs`)

```
node tools/sim_sweep.mjs [N] [numSeats] [courseId] > sweep.csv
```

Races the whole roster via `rosterSeats(n, carIds)` (staggered lanes, cars cycled
across the field) and **rotates the car→lane assignment per race** so a pole-lane
edge can't masquerade as a car edge. `winnerCar` therefore reflects the car, not
the seat. `RIVAL=0` disables rival collisions.

## Analyzer (`tools/analyze_sweep.py`)

```
node tools/sim_sweep.mjs 300 8 1 | python3 tools/analyze_sweep.py
```

Per-car win share plus flags: a car above `fairShare × 1.5` ("likely too strong")
or >20% of races hitting a timeout ("course too long / cars too slow"). Roster
size = the highest car id seen, so a car that never wins cannot shrink the
denominator and hide the imbalance it suffers from.

## Finding

In AI fields thick with rival collisions (~150/race), **acceleration beats top
speed** — the field bunches, so a car that can't re-accelerate out of contact
never reaches its top end. The first draft had blue_bolt at 48% and green_machine
at 13%; tuning cars 2–4 (car 1 fixed) brought all four to 18–32% across courses
1–3 with no flags.

## Verified

`test/balance_sweep.test.js`: roster is four distinct cars; `rosterSeats` cycles
cars on symmetric lanes; a real sweep yields more than one distinct winner car
(car-swap is live); `analyze_sweep.py` computes win shares and flags a dominant
car (skips if `python3` is absent). `./test.sh` → 161/161 + 4 Luau gates.

## Not verified / deferred

No in-game **car-select UI** yet — the roster is data + tooling only; a client
picker (and showing car identity on ghosts) is the natural follow-up. Balance is
measured against the current crude AI driver; a smarter driver would shift the
numbers and want a re-sweep.
