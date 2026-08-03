# 50 — Difficulty (EASY / MEDIUM / HARD)

Established in `marker-0053`. After picking a car, the player picks a difficulty
that scales how much time checkpoints grant. Foundation for the tuned 50-segment
course (specs/48).

## Mechanism (engine)

`shared/constants.js` `DIFFICULTY = { easy: 130, medium: 100, hard: 75 }` — an
integer percent `timeScale`. The reducer scales each checkpoint bonus:
`bonus = timeScale === 100 ? raw : truncDivI32(raw * timeScale, 100)`, read from
`ctx.timeScale` (default 100). **medium = 100 = identity**, so the default and
every golden (which sets no `timeScale`) are byte-for-byte unchanged; the Luau
twin mirrors the same scaling and the checkpoint/fork gates still match.

`ctx.timeScale` is a context knob, NOT hashed state — difficulty is chosen per
run, like seed/course, and only shows up in the timer it produces.

## Select UI (`client/difficulty_select.js`)

Three big buttons EASY / MEDIUM / HARD: `createDifficultySelect` (cursor + level +
`timeScale`), `difficultyFromParams` (`?diff=easy|medium|hard` skips it),
`difficultyTouchZone` (tap a column = pick that button), `drawDifficultySelect`.
`main.js` inserts a **difficulty phase** after car-select: car → difficulty →
countdown → race. `session_local` passes the chosen `timeScale` into `ctx`.

## Verified

`test/difficulty.test.js`: medium/undefined = raw 600, easy = 780, hard = 450 on
seg 2. `test/difficulty_select.test.js`: param gating, cursor→timeScale, touch
columns, draw. `./test.sh` → 218/218 + 4 Luau gates.

## Not verified / deferred

**Multiplayer**: difficulty is LOCAL-only for now — the picker is skipped in
remote mode (server-authoritative). "First player to join selects" needs the room
to hold a `timeScale` and a protocol field; deferred to the server-countdown /
race-framing work. Also, difficulty currently scales only checkpoint bonuses (not
starting time or traffic density) — those can join the model later.
