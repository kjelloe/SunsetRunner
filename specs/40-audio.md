# 40 — Audio (procedural WebAudio)

Established in `marker-0042`. Engine hum, SFX, and a chiptune loop, all
synthesised — no asset files. Client-only, no engine change, no repin. The
AudioContext is injectable so the graph is testable without a device.

## Module (`client/audio.js`)

`createAudio({ AudioContext?, enabled? })` returns a controller:
- `resume()` — spins up the context, engine oscillator, and music. **Must run on
  a user gesture** (browsers block autoplay); nothing is created before it.
- `setSpeed(speed, maxSpeed)` — engine oscillator pitch = `60 + frac*220` Hz, so
  the hum rises with speed (the audible sense of speed).
- `event(kind)` — one-shot SFX: `checkpoint`, `crash`, `nearmiss`, `finish`
  (synth blips with a gain envelope).
- `setEnabled(false)` / `stopMusic()` — mute path.

## Wiring (`client/main.js`)

Armed on the first `keydown`/`pointerdown` (gesture gate). Each race frame:
`setSpeed(self.speed, chosenCar.maxSpeed)`, and SFX fire on **state edges** read
off the self seat — crash entered (`crashedTicks 0→>0`), finish crossed
(`finishTicks <0→≥0`), checkpoint (timer bumped up). `?mute=1` disables it.

## Verified

`test/audio.test.js` (fake AudioContext): import-safe until `resume()`, engine
oscillator created, speed→pitch mapping (0/half/full), one-shot SFX per event,
disabled builds no nodes, `setEnabled(false)` mutes. `./test.sh` → 174/174 + 4
Luau gates.

## Not verified / deferred

Everything you can only judge by ear — mix levels, whether the chiptune is
pleasant, SFX timing feel — needs a device (§17). Music is a single procedural
loop; per-course themes or real tracks are a later option.
