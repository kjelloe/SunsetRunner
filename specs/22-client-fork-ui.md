# 22 — Client fork UI & course select

Established in `marker-0022`. Lets a player drive the fork in-browser (local and
remote) and pick the course. No engine change — no golden repin.

## Controls

- **Q** = fork left, **E** = fork right. Edge-triggered (one press = one choice),
  queued in `client/input.js` (`readForkChoice()`), so holding the key doesn't
  spam choices. Steering stays on the arrows/AD.
- A `◄ Q   FORK   E ►` prompt appears (renderer) when the current or next segment
  is a fork.

## Course select

`?course=N` picks the local course (`main.js` → `createLocalSession({ courseId })`),
e.g. `?course=2` drives `canyon_split`. `?mode=remote` still joins the ws room.

## Session seam

Both sessions gained `setForkChoice(choice)`:
- local — applies `CMD_FORK_CHOICE` to the reducer immediately;
- remote — sends a `forkChoice` protocol message.

`main.js` pumps `readForkChoice()` each frame into `session.setForkChoice`.

## Protocol + server

`shared/protocol.js` gained `C2S.FORK` (`forkChoice`, validated ±1).
`server/index.js` routes it to `room.setForkChoice(seatId, choice)`, which applies
the reducer command and records it — so `dumpReplay()` now carries `forkChoices[]`
and a forked online race replays exactly.

## Verified

`test/client_fork.test.js` — protocol parse/reject, edge-triggered Q/E queue
(fake event target), local-session left≠right routing, and server-room fork apply
+ replay capture. `./test.sh` → 112/112 + 4 Luau gates.

## Not verified

On-screen fork prompt/behaviour needs a native browser (§17). Curves are still
cosmetic (they don't push the car) — addressed next (curve physics), which is
also what makes route-mirror fairness meaningful.
