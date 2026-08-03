# 47 — Race countdown (3-2-1-GO!)

Established in `marker-0049`. A fresh local race counts down **3 · 2 · 1 · GO!**
before anything moves — the clock and car are held at the line until GO. Client-
only, no engine change, no repin.

## Module (`client/countdown.js`)

`createCountdown()` → time-driven off the frame clock:
- `start(now)` — begins the countdown (called when a race starts, after car select).
- `labelAt(now)` — pure: `"3"` (0–800 ms), `"2"`, `"1"`, `"GO!"` (last 700 ms),
  then `null`. `COUNTDOWN_MS` is the total (~3.1 s).
- `isDone(now)` / `draw(g, view, now)` — big centred number, GO! in green.

## Freeze (`client/main.js`)

While `!countdown.isDone(now)` in a **local** race, the frame loop skips
`session.tick()` and holds `last = now`, so the accumulator doesn't bank elapsed
time — the sim is frozen (clock + car) and resumes smoothly on GO with no jump.
Input during the countdown is ignored because nothing advances.

Remote races are server-authoritative — the client can't freeze the server — so
the countdown is **local-only** for now; a server-driven race start is future work.

## Verified

`test/countdown.test.js`: no label before start, the 3→2→1→GO!→done sequence,
`isDone` flips only at the end, and `draw` paints while counting / no-ops when
done. `./test.sh` → 200/200 + 4 Luau gates.

## Not verified / deferred

On-screen look/timing needs eyes (§17). Server-authoritative countdown for
multiplayer (all seats start together after a shared GO) is deferred with the
rest of the race-start rules.
