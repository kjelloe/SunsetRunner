# 78 — Roblox playtest rounds (markers 0121–0141)

Presentation/host-only iteration on the Roblox build, driven by the user's Studio
playtests + screenshots. The deterministic engine (`shared/`+`engine/`, the `luau/`
twin, the 6 lune parity gates, the 316 JS tests) is **untouched throughout** — every
change here is in `roblox/src/` or `roblox/` docs. `rojo build` valid on each marker.

See `roblox/roblox-howto-and-gotchas.md` for the Roblox-specific gotchas these rounds
uncovered (the 2048 Part.Size clamp, coplanar z-fight flicker, ViewportFrame lighting,
etc.).

## Bug fixes
- **0121** — traffic was built in `buildViewFor` but never put in the returned view,
  so `view.traffic` was `nil` and `ipairs` crashed every frame. Add it; guard the
  client loop with `or {}`.
- **0130** — player car was hard-coded red regardless of pick → tint by
  `PLAYER_CAR_COLORS[view.car]`. Colour *flicker*: traffic/rival colour was keyed on
  the player's biome, so a biome change re-tinted the whole field → key on identity.
- **0138** — sunset "only fills the centre": **root cause = Roblox clamps `Part.Size`
  to 2048/axis**, so the wide backdrop was capped and shown as a rectangle. Tile the
  bands + glow across five 2000-wide parts (10000 total).
- **0140** — sunset flicker: gradient bands overlapped in Y at one depth → z-fight.
  Stagger each band 0.6 studs back.

## Race feel / rules
- **0122** — per-player time-up: your finish/timeout ends *your* race immediately with
  a live score panel + SPECTATE the leader (not frozen at 0). Reward is **stages-only**
  (+100/checkpoint, no finish bonus, no collision penalty).
- **0123** — grace-stop: once every human seat is done, end the race within 5 s and
  mark still-running AI cars **STOPPED**.
- **0125** — race HUD: live position `P n/field` + stage progress bar.
- **0128** — human seats fill from the **centre lane outward**, alternating L/R
  (`SEAT_ORDER` by `|laneX|`), instead of player 1 far-left.

## Art & world
- **0122/0123/0130/0138/0140** — sunset: setting-sun neon disc, full-width tiled
  gradient, warm glow, z-separated layers; fixed the horizon "block" (ground vs sky
  overlap) and flicker.
- **0122/0123/0136/0141** — cars: sculpted ~24-part sports coupe (hood/fastback wedges,
  splitter, skirts, haunches, wing, light bars, hubcaps, mirrors, vents, exhausts), 3
  proportion variants; whole-shell tint; accurate ViewportFrame preview (narrow-FOV,
  fills the frame).
- **0122** — per-biome terrain materials (sand/sandstone/concrete/ground/snow/grass) +
  always-on textured side verges.
- **0126** — dusk clouds. **0128** — fuller tree canopies + slimmer trunks.
- **0132** — billboards: pole behind/below the board (no more show-through) + SurfaceGui
  text (fake ads + a green "GO <PLAYER>!" board).
- **0133** — varied traffic vehicles (sedan/estate/fast/bus/lorry/bike) pooled per type
  by kind+id.
- **0136** — decorative **oncoming** stream in the opposing lane (visual-only pool,
  advanced client-side; not collidable — a real collidable oncoming model would be an
  engine change that repins every golden, so kept cosmetic).
- **0137** — over-road CHECKPOINT/FINISH gantries (scan built strips for boundaries) +
  crash camera shake.

## Selection / lobby UX
- **0129/0131/0139** — pre-race selection is now a centred lobby-only panel:
  **SELECT TRACK → [CONFIRM TRACK] → SELECT CAR → [CONFIRM CAR] → RACE LINEUP →
  [READY]** (all humans ready to start). Track thumbnail + rotating car preview,
  arrows + titles, hidden during the race.
- **0135** — track thumbnail is a real **top-down snapshot** of the course curve (walk
  the default path, accumulate the lateral curve = double integral, normalise, plot
  dots + start/finish markers).
- **0134/0141** — the preview car mirrors the in-race rig and fills the frame.

## Later additions (markers 0142–0144)
- **0142** — all-time board upgraded to **OrderedDataStore** (`GetSortedAsync` gives a
  true server-wide top-10; names via `GetNameFromUserIdAsync`, cached). Plain store
  still carries personal points; pcall-guarded in-session fallback.
- **0143** — **engine-hum** audio: a looping Sound with PlaybackSpeed + Volume tracking
  car speed (bundled placeholder `ENGINE_SOUND_ID` — swap for a real engine loop).
- **0144** — **race minimap**: top-left top-down of the course curve + a live player dot
  (by segmentId + roadZ; stage-fraction fallback on fork branches).
- **0145** — playtest fixes: (1) softer **pastel sunset** — the haze layer was glaring
  Neon, now faint SmoothPlastic pastel; softer sun/cut tones. (2) player car holds its
  **selected colour** steadily (dropped the boost-cyan / crash-white full recolour that
  flipped between two colours on boost-pad courses; boost shows via trail + FOV, crash =
  brief light flash). (3) **road no longer gaps** — `buildStrips` hit a fork/`next == -1`
  and returned a SHORT strip array so the road vanished and cars drove on the terrain;
  now it freezes the curve and lays straight strips to the horizon.

## Not done / deferred
- Collidable **oncoming** traffic (engine change; repins goldens) — cosmetic for now.
- Verify bundled **SoundIds** in a live client (incl. the engine-loop placeholder).
- Screenshot-guided fine-tuning of the car silhouette / sun size.
- Optional: near-miss whoosh; publish to Roblox.
