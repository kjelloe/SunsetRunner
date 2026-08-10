# 71 — In-race music track select

Established in `marker-0095`. Client-only (presentation/audio), no engine change,
no golden repin, no Luau change. Completes the backlog "in-race music track
select".

## Why

The procedural audio (`marker-0042`) played a single looping chiptune. This adds a
small set of selectable procedural tracks so the player can pick the vibe, cycled
live with the **M** key. Still zero asset files — every track is synthesised.

## Change

`client/audio.js` replaces the single `MUSIC_LOOP` with a `TRACKS` table of four
procedural loops that share the tempo (`STEP_SECONDS`) and differ only in melody
and timbre (oscillator wave), so the scheduler needs no per-track rework — the
next scheduled note simply reads the active track:

| # | name | wave | feel |
|---|------|------|------|
| 0 | SUNSET | triangle | the original loop (default — unchanged) |
| 1 | NEON | square | low, driving |
| 2 | COAST | sine | bright, mellow |
| 3 | CHROME | sawtooth | edgy, higher |

New API: `audio.track` (`{ index, name, count }`), `audio.setTrack(i)` (wraps),
`audio.cycleTrack()`. `createAudio({ track })` sets the initial track.

Wiring:
- `client/input.js` — `M` is an edge-triggered event (`readMusicCycle()`),
  matching the Q/E fork-queue pattern.
- `client/main.js` — on the M edge (any phase) it calls `audio.cycleTrack()`,
  toasts `♪ <NAME>` via the existing stage announcer, and persists the index to
  `localStorage["sunset.music.track"]`. Startup reads that key (or `?track=N`) and
  constructs the audio on it. Track 0 default means an untouched install sounds
  exactly as before.

## Determinism / parity

None affected — audio is client-only; the engine and all hashes/fixtures/Luau
gates are untouched.

## Verified

`test/audio.test.js` (+3 cases): default is track 0 (SUNSET/triangle); select +
cycle + wrap-around; changing the track changes the next scheduled note's
oscillator wave; and construction from `opts.track` (the persisted / `?track=N`
path). `npm test` → 305/305; `./test.sh` browser smoke boots clean; the M key is
listed in the README controls table.

## Not verified / deferred

The actual musicality of the four loops is a taste call best judged on a device
(`PLAYTEST.md`). A touch control for cycling tracks on mobile is not added (the M
key is keyboard-only); if wanted, it would be a small `?`-menu or a HUD button in
a later slice.
