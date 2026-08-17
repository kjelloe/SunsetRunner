# Roblox how-to & gotchas — Sunset Runner

Everything Roblox-specific we discovered building the Sunset Runner host on top of
the deterministic Luau engine twin. Written as a practical guide so the next person
(or the next session) doesn't relearn it. Ordered by how often it bit us.

The one-line mental model for this project: **the Roblox layer is presentation +
host only.** It runs the SAME deterministic reducer as the browser/lune twin and
renders what comes back. It must never touch engine state, and it may freely use
things the engine can't (`math.random`, wall-clock, floats) because none of that
feeds the hash.

---

## 1. Hard engine limits that silently clamp (these cost us the most)

### Part.Size is capped at 2048 studs per axis
A `Part` bigger than 2048 on any axis is **silently clamped** to 2048 — no error, no
warning. Our sunset backdrop was set to 9000 then 24000 wide and *always* rendered as
a ~2048 central rectangle with dark edges, for several markers, before we found this.

**Fix pattern:** tile wide surfaces across multiple ≤2048 parts.
```lua
local TILES = { -4000, -2000, 0, 2000, 4000 } -- 5 × 2000-wide = 10000 total
for _, tx in ipairs(TILES) do
    local p = Instance.new("Part")
    p.Size = Vector3.new(2000, height, 20)
    p.CFrame = CFrame.new(tx, y, z)
    ...
end
```
Anything meant to fill the view at distance (skyboxes, backdrops, ground planes) will
hit this. Our ground plane (9000 wide) is *also* clamped to 2048 — it happens to be
enough for the near field, but be aware.

### Coplanar overlapping faces z-fight (flicker)
Two surfaces at the **same depth** that overlap in screen space flicker as the depth
buffer can't decide which is in front. This bit us three separate times:
- Sky gradient **bands overlapped in Y at one Z** → the horizon flickered. Fix: give
  each band a tiny Z stagger (`z - i*0.6`) so no two coplanar surfaces overlap.
- The **ground slab overlapped the sky wall** where they intersected → a flickering
  "block" on the horizon. Fix: end the ground *in front of* the sky wall (`z ≈ -1410`
  vs wall at `-1500`) so they never share space.
- A **billboard pole at the same Z as its board** showed through the face. Fix: put
  the pole *behind* the board (`z - 1.6`) and below it.

Rule of thumb: **layer everything on distinct Z** (we use bands 0 / clouds +6 / glow
+12 / sun +20 / cut-lines +24 in front of the backdrop plane).

### Roblox lazy-defers large static distant parts (they "fade in")
A big backdrop built once at init would render **only the centre for ~2 s at every
scene start**, then fill — and a single render hitch (e.g. a screenshot) flushed it and
it stayed full for the rest of the session. That's Roblox deferring large, far, static
geometry until a full re-render. **Fix: move the parts every frame.** We reposition the
sky parts each frame to track the camera's look; because they're "dynamic" Roblox keeps
them in the active render set, so no warm-up (and the backdrop tracks the view for free).

### SurfaceGui text renders even when its part is `Transparency = 1`
Hiding a billboard/gantry by setting the part transparent leaves its **SurfaceGui text
floating in space** (the "CHECKPOINT hanging at the start" bug). Toggle the label's
`Visible` (or the SurfaceGui's `Enabled`) alongside the part's transparency.

### A flat backdrop can't cover a camera that rotates
If the chase camera **pans/rotates into corners**, a flat sky wall's edge swings into
view (you "see past the sunset"), and panning also pushes the near road + the player car
off-screen. Either keep the camera **straight** and dampen the *road's* lateral curve so
corners stay on screen (we use `CURVE_DAMP`), or make the backdrop wrap — a flat wall
only covers ≈±73° around its normal.

### Match the visible car to the collision footprint
The crash box is `CAR_WIDTH` **engine units** (`shared/collision.js`); the render picks
its own stud size. If they disagree you crash with a visible gap (or clip without a
crash). Convert: `studs = CAR_WIDTH * SX`. We size cars near that (and slimmed
`CAR_WIDTH` itself when we wanted a more forgiving hitbox — a conscious golden repin).

---

## 2. Rojo project & sync

- `default.project.json` mounts repo dirs into the DataModel:
  `luau/`→`ReplicatedStorage.Shared`, `data/`→`ReplicatedStorage.GameData`,
  `src/server`→`ServerScriptService`, `src/client`→`StarterPlayerScripts`.
- **`globIgnorePaths`** excludes the parity harness (`*-check.luau`) so lune-only test
  files don't get synced into the game.
- The `.rbxl` place file and `.lock` are **local and gitignored** — Rojo is the source
  of truth, not the binary place.
- **Optional source paths need a Rojo RECONNECT.** `src/server`/`src/client` are
  `optional` in the project; a Studio session connected *before* those dirs existed
  won't pick them up. Symptom: **empty world, only baseplate + spawn.** Fix: stop
  `rojo serve`, restart, and **Connect** again (or Disconnect→Connect in the plugin).
- `rojo build default.project.json -o out.rbxl` is a fast **syntax/scaffold check** in
  CI/headless (it does NOT type-check Luau, but it catches parse errors and bad refs).

### `require()` resolution
Modern Roblox resolves lune-style `require("./sibling")` as **sibling ModuleScripts**,
so the exact same `luau/` modules run under both `lune` (tests) and Roblox with **no
require rewrite**. Data JSON mounted via Rojo becomes **require-able tables**
(`require(GameData.roads)` returns the parsed table) — no `HttpService:JSONDecode`.

---

## 3. The determinism boundary (do not cross it)

- The engine (`luau/` mirroring `shared/`+`engine/`) is **integer fixed-point, pure,
  hashed**. The Roblox render/host layer is separate and may use floats,
  `math.random`, `os`/wall-clock, `tick()`, etc. — because none of it feeds the state
  hash. We use `math.random` freely for cosmetic variety (oncoming cars, ad boards).
- **Never** call `math.random`/wall-clock **inside** an engine module — it breaks the
  JS↔Luau byte-parity gates. Keep that code in `src/`.
- The server host runs the reducer at 20 Hz on a `Heartbeat` accumulator and streams
  per-seat views; the client renders at ~60 Hz by interpolating between views. The
  engine advances `roadZ` by `speed` each tick, so the client extrapolates
  `renderRoadZ += speed*20*dt` between views and snaps on segment change.

---

## 4. Parts, rigs & the "treadmill" render pattern

- **Treadmill:** the player car stays near the origin and the *world scrolls toward
  it*. Because the camera barely moves, a **static backdrop wall** reads as the sky,
  and pooled road/prop/traffic parts are just repositioned by depth each frame.
- **Object pooling:** create fixed pools once; each frame, show/hide via
  `Transparency` (0/1) and reposition by `CFrame`. Never create/destroy per frame.
  Assign nearest-first and hide the unused tail, or the pool renders an arbitrary far
  subset (we hit "the car you're about to hit is invisible" from unsorted pooling).
- **No Model/pivot for simple rigs:** build a car as a flat list of
  `{ part, offset }` and place with `part.CFrame = base * offset`. Dead simple, can't
  mis-pivot. (A `Model:PivotTo` works too but is overkill and easy to get wrong.)
- **Cosmetic parts** should be `Anchored = true` and
  `CanCollide/CanQuery/CanTouch = false` — no physics cost, no raycast hits.
- **Per-part "shown" transparency:** if a rig has glass (0.25) / shadow (0.55) / neon
  (0), a blanket `Transparency = 0` on show ruins them. Store each part's shown-alpha
  and restore that, not 0.

### Shape primitives
- **WedgePart:** the tall vertical face is on **+Z**, the slope descends toward **−Z**.
  To flip (e.g. a fastback vs a hood), rotate 180° about Y: `* CFrame.Angles(0, math.rad(180), 0)`.
- **Cylinder (`Part` with `Shape = Cylinder`):** the circular faces are on the local
  **X** axis. For a wheel facing sideways that's fine; to point a disc at the camera
  (our sun) rotate 90° about Y.
- **Ball** for canopies/rocks.

---

## 5. Materials, lighting & the sunset

- **Material matters for readability:** `Grass`/`Sand`/`Sandstone`/`Snow`/`Concrete`
  read as real terrain; `SmoothPlastic` looks flat. Set material **only when it
  changes** (we change-gate on biome), not every frame.
- **Neon** is full-bright and **ignores lighting, fog and atmosphere.** Perfect for
  suns, glows, head/tail-lights, boost pads. It also blooms, so keep huge neon
  surfaces moderate in colour.
- **Atmosphere `Density`/`Haze` desaturate distant geometry toward the atmosphere
  colour** — this is what washed our sunset edges to grey-blue. Turning Density
  `0.28→0.1` and Haze `1.5→0.3` and pushing `FogEnd` back kept the backdrop
  saturated. (The *real* culprit for "not wide enough" was the 2048 clamp, but haze
  was a secondary washing effect.)
- **Fog** (`FogStart`/`FogEnd`, `FogColor`) fades the far treadmill into the horizon.
  Keep the backdrop wall *inside* fog for a hazy blend, or push fog out to keep it
  crisp — pick one deliberately.
- `Lighting.ClockTime` sets sun angle/sky tint; `ColorCorrectionEffect.Saturation`
  compensates when saturated props wash out.
- **The default skybox still shows** anywhere your backdrop wall doesn't cover (above
  it, or if it's too small — see the 2048 clamp). Make the wall tall/wide enough, or
  add a `Sky` instance, or you'll see default blue/navy at the edges.

---

## 6. GUI: ViewportFrame, SurfaceGui, BillboardGui, ScreenGui

- **ViewportFrame** (our rotating car preview):
  - Needs its **own `Camera`** parented to it with `vp.CurrentCamera = cam`.
  - Renders **dark by default** — set `vp.Ambient`, `vp.LightColor`,
    `vp.LightDirection` or the model is unlit.
  - Parts can be parented **directly** to the ViewportFrame (or via a `Model`).
  - `FieldOfView` is on the **viewport's camera**; the default 70 makes models tiny —
    use a **narrow FOV (~40) + closer orbit** to fill the frame.
- **SurfaceGui** (billboard/gantry text): set `Adornee`, `CanvasSize`, and **`Face`** —
  note `Enum.NormalId.Back` is **+Z** (the face toward a camera looking down −Z).
- **BillboardGui** (rival name tags): always faces the camera; set `Adornee` +
  `StudsOffset`, `AlwaysOnTop`.
- **ScreenGui**: `IgnoreGuiInset = true` to use the full screen; `ResetOnSpawn =
  false` so it survives respawns; parent to `Players.LocalPlayer.PlayerGui`.
- `TextScaled = true` auto-fits text; `UICorner` for rounded panels.

---

## 7. Input & camera

- **UserInputService:** `IsKeyDown` for held state, `InputBegan/InputEnded` for edges;
  always check the `gameProcessedEvent` arg and bail if true (typing in chat, etc.).
- **Mobile:** gate touch UI on `UIS.TouchEnabled`; on-screen `TextButton`s work for
  both mouse and touch (`MouseButton1Click` fires on tap).
- **Drag controls (marker-0158 — steering wheel / set-speed lever):** a tap button
  can't do analog drag. Capture the press with `frame.InputBegan` (store the
  `InputObject` + anchor), then follow the drag on **`UIS.InputChanged`** and end on
  **`UIS.InputEnded`**, not on the frame (a drag leaves the frame's bounds). Match the
  moving input to the active one: for **touch** it's the *same* `InputObject`
  (`input == active`); for **mouse** the move arrives as a *different* object of type
  `MouseMovement`, so also accept `MouseMovement` while the active press is
  `MouseButton1`. Set `frame.Active = true` so it sinks the press. Rotate a wheel with
  `frame.Rotation`; make a circle with `UICorner` radius `UDim.new(0.5,0)` + a square
  `SizeConstraint = RelativeYY`. A **set-speed lever** turns its knob fraction into
  accel/brake against the live car speed (a client-side cruise mirror of
  `client/touch_controls.js` `cruiseInput`) — the engine stays authoritative.
- **Camera:** set `CameraType = Enum.CameraType.Scriptable` to drive it yourself, then
  set `CFrame` every `RenderStepped`. `FieldOfView` is the **vertical** FOV; horizontal
  is derived from the viewport aspect ratio (this is why a wall that fills a 16:9 view
  can fall short on ultrawide — size for the widest case).
- **RunService:** `Heartbeat` for the server sim tick (accumulator pattern);
  `RenderStepped` for client render + camera + any per-frame extrapolation.

---

## 8. Networking (RemoteEvents)

- Two `RemoteEvent`s: intents in (`FireServer`), per-seat views out
  (`FireClient` / `OnClientEvent`). Server is authoritative.
- **Replication timing:** the client must `WaitForChild` the RemoteEvents and the
  replicated `Shared`/`GameData` folders — they may not exist on the first frame.
- Send **plain tables** (no functions/instances) across the boundary. **A field you
  build but forget to put in the returned view is just `nil` on the client** — this
  cost us a full-race `ipairs(nil)` crash when `traffic` was built but not returned.
  Guard client iteration with `ipairs(x or {})` as belt-and-braces.

---

## 9. DataStore (all-time leaderboard)

- Wrap **every** DataStore call in `pcall` and degrade to in-session-only on failure.
- In Studio you must enable **Game Settings → Security → "Enable Studio Access to API
  Services"** or all calls throw — the pcall guard makes that a graceful no-op.
- It works automatically in a published/live game.

---

## 10. Audio

- Use **bundled** sounds (`rbxasset://sounds/…`, e.g. `electronicpingshort.wav`,
  `action_jump.mp3`, `uuhhh.mp3`) to avoid marketplace-asset dependencies.
- `Sound.PlaybackSpeed` re-pitches one sample for different cues (we pitch one ping for
  checkpoint / countdown / GO / finish).
- Parent one-shot SFX to `SoundService`. Calling `:Play()` on a missing SoundId is
  **harmless** (just silent) — but verify ids actually exist; they're easy to get
  wrong and there's no error. *(Ours are still unverified in a live client.)*

---

## 11. Misc gotchas

- **`CharacterAutoLoads = false`** (Players service) for a non-avatar game — no
  ragdoll spawns, camera is fully yours.
- **This repo uses TAB indentation** in `.luau` files; mixing spaces breaks exact-match
  edits and looks inconsistent.
- Studio's **"Animation Spoofer cannot run while game is running"** output spam is from
  a Studio plugin, **not our code** — ignore it.
- **Boot prints** (`server booting…`, `first server view received…`) are the fastest
  way to localise "nothing renders": whichever expected line is missing tells you which
  layer didn't run.
- Property writes aren't free at scale — **change-gate** them (only set colour/material
  when the value actually changes; only rebuild the track-thumbnail path when the
  course changes).

---

## 12. Patterns worth reusing

- **Course curve is a double integral of `curveProfile`** (`curveDx += curve; curveX +=
  curveDx`). We use it for the road shape *and* for the top-down track thumbnail
  (walk the default path, accumulate, normalise, plot).
- **Cosmetic-only systems that don't touch the engine:** the oncoming-traffic stream is
  a client-side pool with its own `roadZ` advanced in `Render.step` — visually rich,
  zero determinism risk. Prefer this over an engine change when the feature is purely
  presentational (a real collidable oncoming model would repin every golden).
- **Pool-by-type:** varied traffic (sedan/estate/fast/bus/lorry/bike) is separate pools
  keyed by `kind + id`, assigned nearest-first — stable shapes without per-frame
  rebuilds.
