# Running Sunset Runner

## Tests

```bash
npm test      # node --test — unit suites, golden fixtures, Luau parity gate
./test.sh     # full self-test: JS suite + lune Luau parity, with a summary
```

## The client (solo local race)

The client fetches `data/*.json`, so it must be served over http (not opened as
a `file://` URL). Serve the repo root and open the client page:

```bash
python3 -m http.server 8000     # run from the repo root
# then open http://localhost:8000/client/index.html
```

Drive with the arrow keys (or WASD): up = accelerate, down = brake, left/right =
steer. At a fork, press **Q** (left) or **E** (right). The road, player car,
speed/timer HUD, and a fork prompt render at 60 fps over a 20 Hz sim.

On touch devices, on-screen buttons appear: `◄`/`►` steer (bottom-left),
`BRK`/`GAS` (bottom-right), `Q`/`E` fork (top corners). Add `?touch=1` to preview
them on desktop.

Course select (local): `?course=2` drives the branching `canyon_split` course,
e.g. `http://localhost:8000/client/index.html?course=2`. `?mode=remote` joins
the ws server room instead.

Visual feel/perf tuning is a native-browser task (brief §17); WSL/SwiftShader is
correctness-only.

## Luau twin parity

```bash
lune run luau/spine-check.luau   # recompute spine golden vectors in Luau
```
