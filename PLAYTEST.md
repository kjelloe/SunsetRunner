# Playtest checklist — Sunset Runner

The automated suite (`./test.sh`, 227 tests + 4 Luau parity gates) covers engine
determinism, the reducer, server room, fairness, and client module loading. It
does **NOT** cover anything you can only judge with a real browser: visual feel,
frame rate, camera tuning, touch ergonomics, audio, and real-network multiplayer.
This list is that gap — the things a human must verify.

Legend: **[feel]** = subjective judgement (record an opinion), **[bug]** = pass/
fail, **[unverified]** = never seen working, watch closely.

## 0. Setup

```bash
npm test            # expect all pass + 3 "LUAU ... PARITY OK" lines
python3 -m http.server 8000   # from repo root (or `npm start` for the ws server)
```
Open `http://localhost:8000/client/index.html`.

- [ ] **[feel]** A **SUNSET RUNNER** splash over a beach/palms shows first, with a
  **LOADING** bar filling, then the car-select appears (marker-0052).
- [ ] **[bug]** Page loads with NO console errors (regression guard: the
  `server/protocol.js` MIME bug, marker-0019).
- [ ] **[bug]** You see a sunset sky (top), road receding to the horizon, green
  shoulders, and a red car near the bottom — NOT the road up in the sky
  (regression guard: the projection flip, marker-0020).

## 1. Solo run — course 1 (sunset_coast)

- [ ] **[bug]** A fresh race shows **3 · 2 · 1 · GO!** and the car/clock stay
  frozen until GO (marker-0049). TIME does not tick during the countdown.
- [ ] **[bug]** Up/W accelerates; SPEED climbs; the road scrolls toward you.
- [ ] **[bug]** Down/S brakes; SPEED drops.
- [ ] **[bug]** Left/Right (or A/D) move the car sideways; it can go onto the
  green shoulder.
- [ ] **[feel]** Speed sensation, road-scroll rate, steering response — does it
  feel like an arcade racer? Camera magnitudes are untuned first passes — **dial
  them live**: add `?tune=1` to see current values, then tweak with
  `?depth=`/`?height=`/`?roadw=`/`?hill=`/`?follow=`/`?nearz=` (marker-0046).
  Screenshot the `?tune=1` panel with values you like and report them back.
- [ ] **[bug]** TIME counts down; passing the checkpoint (~⅓ in) adds time (watch
  TIME jump up).
- [ ] **[bug]** Reaching the end triggers a **FINISH! splash with confetti +
  fireworks** (marker-0031).
- [ ] **[bug]** After the race ends (finish OR time-up), a **RACE OVER** summary
  lists the field with the stage each reached, then **NEW RACE IN 30s** counts
  down and auto-starts a fresh race (marker-0055).
- [ ] **[feel]** The road **scrolls** and objects whip past — you should now feel
  speed (marker-0030 fixed the static-road bug). Faster = faster scroll?
- [ ] **[bug]** Idle (don't accelerate) until TIME hits 0 → TIME UP banner, car
  stops.
- [ ] **[feel]** Traffic cars appear ahead; hitting one visibly crashes/slows you
  (marker-0016). Is the crash readable?
- [ ] **[feel]** Roadside palms/signs scroll past (marker-0026) — do they read as
  scenery or noise?
- [ ] **[bug]** The default course now has **hills** (road crests and dips) and a
  **fork** after the checkpoint — you reach it in normal play (marker-0036).
- [ ] **[feel]** Are the hills readable (crest hides the road beyond, then reveals)?
  Too gentle / too steep? Tune live with `?hill=` (default 180, marker-0046).
- [ ] **[feel]** After the fork, the two branches and the merge leg look
  **distinct** — sky/ground palette and roadside density change (beach / canyon /
  forest, marker-0044). Drive both branches: do they read as different places?

## 2. Curves & drift — feel

- [ ] **[bug]** Holding forward now BUILDS speed on straights and you can recover
  after a traffic crash (marker-0032 crash-stun; was: crashed every tick / speed
  bled to nothing).
- [ ] **[feel]** Flat-out through a sharp curve should tip you onto the grass
  (speed dip) — **braking before the turn** keeps you on; **steering** holds the
  line. Does braking/steering feel worth it? Too harsh / too weak? (`CURVE_PUSH_DEN`
  320, steerHigh 14 are sim-tuned first passes.)

## 3. Forks & course select — course 2 (canyon_split)

Open `...index.html?course=2`.

- [ ] **[bug]** A `◄ Q   FORK   E ►` prompt appears as you approach the fork.
- [ ] **[bug]** Pressing **Q** takes the left branch, **E** the right (drive it
  twice; the routes differ — right branch grants a checkpoint).
- [ ] **[bug]** With NO key, the fork follows your **lane position**: drift left of
  centre → left branch, at/right of centre → right branch (marker-0048). Steer
  into a branch and confirm you take it.
- [ ] **[feel]** Is the fork readable in time to choose?

## 4. Mirror course — course 3 (mirror_valley)

Open `...index.html?course=3`.

- [ ] **[feel]** Left and right branches curve in mirror directions; both should
  feel equally hard (the engine proves them fair — see it in play).

## 4b. Grand tour — course 4 (marker-0054)

Open `...index.html?course=4`.

- [ ] **[feel]** A long 55-segment tour through six biomes (sunset -> beach ->
  canyon -> forest -> city -> night) with three forks. Do the biomes read as
  distinct places? Are legs ~30-60s and checkpoints roughly keeping you alive on
  Medium (tighter on Hard, generous on Easy)?

## 5. Mobile touch controls

On a phone (or desktop with `...index.html?touch=1`):

- [ ] **[bug]** On-screen **arrow pad** appears: `◄`/`►` (steer, left thumb),
  `▲`/`▼` (accel/brake, right thumb), `↰`/`↱` (fork, top corners).
- [ ] **[bug]** Hold a steer button → car steers; release → stops.
- [ ] **[bug]** Two fingers at once (steer + GAS) both register.
- [ ] **[bug]** Tapping a fork button chooses that branch (one tap = one choice).
- [ ] **[bug]** Canvas fills the screen keeping 16:9 (no overflow / page scroll);
  buttons are hit-tested correctly at that scale (marker-0029 fixed the CSS-scale
  mapping bug — verify a tap actually triggers the button under your finger).
- [ ] **[bug]** Page does not scroll or pinch-zoom while you drag on the canvas.
- [ ] **[bug]** High-DPR crispness: the canvas buffer is now sized to CSS × DPR
  (marker-0038) — is it acceptably sharp on a retina phone (no blur)?
- [ ] **[bug]** The screen stays awake while driving (wake lock, marker-0038).
- [ ] **[feel]** Are the buttons in reachable spots / big enough?

## 6. Multiplayer — server room

```bash
npm start           # serves + ws room on :8000
```
Open TWO browser tabs at `http://localhost:8000/client/index.html?mode=remote`.

- [ ] **[bug]** Both tabs join (each is a seat); you see the other car as a
  ghost when you share a segment.
- [ ] **[bug]** Drive both — positions update live in each tab.
- [ ] **[unverified]** **Prediction feel** (marker-0028): your own car responds
  to input INSTANTLY, not after a round-trip delay. Watch for rubber-banding /
  snapping when the car crashes into traffic (the server correction).
- [ ] **[bug]** Same-segment rival collision (if enabled) bumps both cars apart.
- [ ] **[bug]** Entities follow the curve: on a bend, ghosts/traffic sweep with
  the road, not in a straight column (marker-0035).
- [ ] **[feel]** Each rival ghost is **tinted by its car** (red/blue/green/gold,
  marker-0045) matching the colour of its name in the car-select screen — can you
  tell rivals apart? Tints legible against the road/scenery?

### Reconnect / drop-in (marker-0034)

- [ ] **[bug]** Background the tab for a few seconds, then return → back in the
  SAME run (reconnect-on-visible + token reclaim), not a fresh seat.
- [ ] **[bug]** Reload the page mid-race → the persisted token reclaims your seat.
- [ ] **[bug]** Open a second tab (same browser) → it supersedes the first (the
  first tab's socket closes); one seat, latest tab wins.
- [ ] **[bug]** Stay backgrounded past the grace window (default 45 s) → on return
  you drop back in as a fresh seat, never a frozen HUD.
- [ ] **[bug]** Restart the server (`npm start`, then Ctrl-C, then `npm start`
  again) mid-race → the browser reconnects and reclaims the SAME run within a few
  seconds (server-restart persistence, marker-0037; state in `.state/session.json`).
- [ ] **[bug]** During any drop/restart a **RECONNECTING…** banner shows and clears
  once you're back live (marker-0039).

## 7. Determinism / regression sanity

- [ ] **[bug]** `node debugging/replay.mjs` prints a race report ending with a
  `finish` event (checkpoint_1a accel-only finishes at tick 297).
- [ ] **[bug]** `node debugging/sim_campaign.mjs` prints 5 seeds, all finishing,
  "systems fired" true for finish/checkpoint/collision.
- [ ] **[bug]** `node debugging/fairness.mjs` prints mirror = FAIR and
  traffic-swap: course-3 residual much smaller than course-2 (geometry fair).

## 8. Audio (marker-0042)

Procedural WebAudio — synthesised, no asset files. Autoplay is blocked until you
interact, so press a key / tap first. `?mute=1` disables it.

- [ ] **[feel]** After the first keypress, an **engine hum** starts and its pitch
  **rises with speed** — accelerate and listen. Too harsh / too quiet?
- [ ] **[feel]** SFX fire on events: a **crash** growl when you hit traffic, a
  **checkpoint** blip when TIME jumps up, a **finish** flourish at the line. Do
  they land at the right moment?
- [ ] **[feel]** A background **chiptune loop** plays. Pleasant or annoying?
- [ ] **[bug]** `?mute=1` → total silence, no console errors.

## 9. Car select (marker-0041)

- [ ] **[bug]** On load (no `?car=`) a **CHOOSE YOUR CAR** overlay shows with stat
  bars; `◄`/`►` (or A/D) cycles cars, Enter/Space (or tap) starts the race.
- [ ] **[bug]** `?car=3` skips the overlay and starts in that car.
- [ ] **[feel]** Do the four cars feel distinct (speed vs accel vs grip)?
- [ ] **[bug]** After the car, a **SELECT DIFFICULTY** screen shows EASY / MEDIUM /
  HARD (marker-0053); tap/enter one to start. EASY should give noticeably more
  time at checkpoints than HARD. `?diff=hard` skips it. (Local only for now.)

## What to report back

For each **[feel]/[unverified]** item: a screenshot + one line ("too fast",
"curve push too weak", "buttons too small", "car snaps on crash"). Those drive the
native-tuning pass I can't do headlessly (§17). For any **[bug]**: the console
output + steps.
