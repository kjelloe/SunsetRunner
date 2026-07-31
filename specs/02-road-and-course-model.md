# 02 — Road & course model

Established in `marker-0002` (slice-003). The road is not a mesh — it is a graph
of pseudo-3D strip segments (brief §8). This spec pins the data schema and the
loader contract every later slice (physics, renderer, forks, traffic) builds on.

## Data shape (`data/roads.json`)

Two integer-keyed arrays.

**courses[]**
| field         | type    | notes                                     |
|---------------|---------|-------------------------------------------|
| `id`          | int > 0 | unique course id                          |
| `nameKey`     | string  | i18n key, e.g. `course.sunset_coast`      |
| `startSegment`| int     | must resolve to a segment                 |

**segments[]**
| field            | type       | notes                                            |
|------------------|------------|--------------------------------------------------|
| `id`             | int > 0    | unique                                           |
| `stripCount`     | int > 0    | number of pseudo-3D strips in the segment        |
| `checkpointTicks`| int ≥ 0    | bonus time added on passing (0 = no checkpoint)   |
| `next`           | int        | next segment id, or `-1` for finish (linear only)|
| `forkLeft`       | int        | left branch id, or `-1`                          |
| `forkRight`      | int        | right branch id, or `-1`                         |
| `curveProfile`   | int[]      | integer curvature indices along the segment      |
| `hillProfile`    | int[]      | integer hill indices along the segment           |
| `trafficSeed`    | int ≥ 0    | per-segment deterministic traffic seed           |
| `scenerySet`     | int ≥ 0    | scenery set id                                    |

All numbers are integers — no floats anywhere in course data (determinism).

## Fork-vs-linear exclusivity (invariant)

A segment is exactly one of:
- **linear** — `forkLeft = forkRight = -1`, routes via `next` (an id or `-1`);
- **fork** — both `forkLeft ≥ 0` and `forkRight ≥ 0`, and `next = -1`.

Mixing the two (a fork that also sets `next`, or a fork with one branch) is a
load error, so routing in the reducer is never ambiguous.

## Loader contract (`shared/road_data.js`)

Pure and dependency-free; the fs read happens at the edge (the loader takes
already-parsed JSON) so the module stays Luau-portable.

- `loadCourseSet(json)` → validates everything above (integer fields, positive
  ids, no duplicates, referential integrity of `next` / `forkLeft` / `forkRight`
  / `startSegment`, fork-vs-linear exclusivity) and returns
  `{ courses, segments, coursesById, segmentsById }`. Throws on any violation.
- `getCourse(cs, id)` / `getSegment(cs, id)` — indexed lookup, throw on unknown.
- `nextSegment(cs, id, choice)` — resolve the segment a car advances into.
  Linear: returns `next`. Fork: `FORK_LEFT`/`FORK_RIGHT` select the branch; with
  no choice a fork defaults **LEFT** deterministically. Returns `-1` at finish.

## Content-drift pin

`test/road_data.test.js` pins an FNV-1a 64 fingerprint of the shipped
`sunset_coast` course (`9ce3b09a51d60a88`). An accidental edit to the course
data fails the suite; a deliberate edit is repinned as a conscious act, logged
in `dev-log.md` — the §18 "manifest changes cannot silently shift" doctrine
applied to road data.

## Current content

One course, `sunset_coast` (id 1): three linear segments 1→2→3→finish, with the
checkpoint on segment 2 (`checkpointTicks 600` = 30 s at 20 Hz). A course
**authoring format/example** from the user is expected next; until then new
courses follow this schema by hand.
