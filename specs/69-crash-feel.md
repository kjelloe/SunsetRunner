# 69 — Crash impact feel (screen shake + red flash)

Established in `marker-0093`. Client-only (presentation), no engine change, no
golden repin, no Luau change. From the backlog "richer crash/near-miss feel".

## Why

A traffic/rival crash was already fully modelled by the engine (the `crashedTicks`
stun) and announced with a one-shot `crash` SFX, but nothing on screen sold the
impact — the car just froze for the stun. An arcade racer wants the hit to *land*.

## Change

New `client/crash_feel.js` (`createCrashFeel`): on the local car's crash edge it
runs two short, decaying, wall-clock-driven effects over the float Canvas layer —

- **Screen shake** (~420 ms): the whole scene is translated by a decaying,
  two-frequency offset whose amplitude scales with view height (so it reads the
  same at any buffer size / DPR). Applied by wrapping the world `render()` call in
  `main.js` with `g.translate(dx, dy)`.
- **Red impact vignette** (~260 ms): a radial flash, strong at the edges and clear
  at the centre so the road stays readable, drawn on top of the shaken scene.

Wiring in `main.js`: triggered in the same crash-edge branch that already fires
`audio.event("crash")` (`crashedTicks > 0 && prevCrashed === 0`), reset on race
start alongside the celebration. It reads no engine state beyond that edge.

## Determinism / parity

None affected. `crash_feel.js` lives in the client float layer (Math + wall-clock
are fine there, never in `engine/`/`shared/`); the engine crash + stun and their
hashes are untouched, so all golden fixtures and the 4 Luau parity gates are
unchanged.

## Verified

`test/crash_feel.test.js` locks the timing contract: shake is zero before trigger
/ non-zero during / zero after it decays and never grows late; the flash draws
only inside its window; `active()` spans the longer window and `reset()` clears
it. `npm test` → 296/296; `./test.sh` browser smoke still boots clean (the
render-wrap change renders without console errors).

## Not verified / deferred

Real feel (shake amplitude, flash strength, the ~420/260 ms durations) needs the
`PLAYTEST.md` device pass. Near-miss feel (a whoosh + brief highlight when just
dodging traffic) is a separate future slice — the engine already computes the
near-miss/bonus event that would drive it.
