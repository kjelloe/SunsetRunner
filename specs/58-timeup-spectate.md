# 58 — Multiplayer time-up: Re-join / Spectate

Established in `marker-0077`. In multiplayer, when your race ends (finish or
time-up) the summary offers two choices instead of the local auto-restart:
**RE-JOIN** or **SPECTATE**. Client-only.

## Flow (`client/main.js` + `client/spectate.js`)

- `summary` phase, remote: `drawRaceSummary(..., -1)` (no countdown line) +
  `drawTimeUpButtons`. Select with ◄ ► + Enter, or tap a button
  (`timeUpTouchZone`). RE-JOIN → `start()` (fresh JOIN); SPECTATE → `spectate` phase.
- `spectate` phase: render the world from a rival's point of view — a synthetic
  self seat built from the chosen ghost, the rest as ghosts — with the spectated
  name centre-bottom (`drawSpectateOverlay`). ◄ ► cycle rivals; Enter / centre-tap
  re-joins (`spectateTouchZone`). The session stays connected so the view is live.

## Verified

`test/spectate.test.js`: button/column touch zones and the two draws (buttons +
overlay with name and index). `./test.sh` → 263/263 + 4 Luau gates.

## Not verified / deferred

Spectate uses the viewer's traffic feed (filtered to the old segment), so traffic
isn't shown around the spectated car — a server-side "spectate target" feed would
fix that. **RE-JOIN restarts from the start, not the current stage**, and there is
still **no points system** ("earn points from there" is future). Real device
verification of the flow is pending (§17).
