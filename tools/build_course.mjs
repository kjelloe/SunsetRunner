// tools/build_course.mjs — generate the big "grand_tour" course (specs/48).
// Authors think in SECONDS per leg (30-60 s @ Medium); this derives stripCount,
// lays out biomes + rejoining forks + per-segment checkpoints, validates the
// graph, appends it as course 4 (ids >= 100 — courses 1-3 and their goldens are
// left untouched), and prints a leg-time report. Deterministic (no RNG), so
// re-running yields byte-identical output.
//
//   node tools/build_course.mjs         # write data/roads.json
//   node tools/build_course.mjs --check # report only, don't write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ROAD_UNIT, TICK_HZ } from "../shared/constants.js";
import { loadCourseSet } from "../shared/road_data.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roadsPath = resolve(root, "data/roads.json");

// Reference sustained "Medium" cruise speed (internal units/tick). A leg's
// stripCount is chosen so it takes ~`seconds` to cross at this speed.
const CRUISE = 2000;
const secondsToStrips = (sec) => Math.round((sec * CRUISE * TICK_HZ) / ROAD_UNIT);
const stripsToSeconds = (strips) => (strips * ROAD_UNIT) / (CRUISE * TICK_HZ);

// Curve/hill keyframe shapes (integer, sampled across the segment).
const SEC_CYCLE = [40, 48, 34, 52, 44, 38, 50];

// Balanced ELEMENTS: a leg is a sequence of ~7 s elements (playtest: swap between
// curve-left / curve-right / straight / hill, each 5-10 s). Keyframes are sampled
// stepwise across the segment, so one keyframe ≈ one element.
function elementCount(seconds) {
  return Math.max(5, Math.min(9, Math.round(seconds / 7)));
}

// Curve profile: every stage OPENS with a straight (3-8 s), then alternates
// straight <-> curve each element, flipping curve direction. No two straights are
// adjacent, so no straight runs longer than ~8 s.
function legCurve(seconds, k) {
  const n = elementCount(seconds);
  const cp = [0]; // element 1 — straight opener
  let turns = 0;
  for (let i = 1; i < n; i++) {
    if (i % 2 === 1) {
      const sharp = ((k + turns) % 3 === 0) ? 3 : 2;
      const sign = ((k + turns) % 2 === 0) ? 1 : -1;
      cp.push(sign * sharp);
      turns++;
    } else {
      cp.push(0); // straight element
    }
  }
  return cp;
}

// Hill profile: rolling crests/dips. Mountain (10) & alpine (11) emphasise
// DOWNHILL — the road descends then climbs back.
function legHill(seconds, biome) {
  const n = elementCount(seconds);
  const up = [0, 1, 2, 3, 2, 1, 0, -1, 0];
  const down = [0, -1, -2, -3, -2, -1, 0, 1, 0]; // descend then climb
  const pat = (biome === 10 || biome === 11) ? down : up;
  const hp = [];
  for (let i = 0; i < n; i++) hp.push(pat[i % pat.length]);
  return hp;
}

// Ten terrain bands (scenerySet -> scenery.json themes), a progression from coast
// to alpine to night. 47 legs + 3 forks (each adds one on-route segment) = a
// 50-stage main route.
const BANDS = [
  { biome: 1, name: "palm", n: 5 },
  { biome: 2, name: "beach", n: 5, forkIdx: 2, detour: 8 },      // detour: lake
  { biome: 7, name: "wheat", n: 5 },
  { biome: 8, name: "lake", n: 5, forkIdx: 2, detour: 9 },       // detour: autumn
  { biome: 4, name: "forest", n: 5 },
  { biome: 9, name: "autumn", n: 4 },
  { biome: 3, name: "canyon", n: 5 },
  { biome: 10, name: "mountain", n: 4, forkIdx: 2, detour: 11 }, // detour: alpine
  { biome: 11, name: "alpine", n: 5 },
  { biome: 6, name: "night", n: 4 },
];

// Flatten bands into an ordered list of "legs"; a leg is a line or a fork.
function buildLegs() {
  const legs = [];
  let k = 0;
  for (const band of BANDS) {
    for (let i = 0; i < band.n; i++) {
      const seconds = SEC_CYCLE[k % SEC_CYCLE.length];
      const base = {
        name: `${band.name}_${i + 1}`, biome: band.biome, seconds,
        curveProfile: legCurve(seconds, k), hillProfile: legHill(seconds, band.biome),
      };
      if (band.forkIdx === i) {
        // A fork: two branches (current biome vs a detour biome) that rejoin,
        // each a constant-direction sweep so the split is clearly visible.
        legs.push({
          type: "fork", ...base,
          left: { name: `${band.name}_${i + 1}L`, biome: band.biome, seconds: seconds + 5, curveProfile: [-2, -2, -2, -2], hillProfile: [0, 1, 2, 1, 0] },
          right: { name: `${band.name}_${i + 1}R`, biome: band.detour, seconds: seconds + 10, curveProfile: [2, 2, 2, 2], hillProfile: [0, -1, -2, -1, 0] },
        });
      } else {
        legs.push({ type: "line", ...base });
      }
      k++;
    }
  }
  return legs;
}

// Two-pass id assignment: forks emit 3 segments (fork + 2 branches).
function assemble(legs) {
  let id = 100;
  const entry = []; // entry id of each leg
  for (const leg of legs) { entry.push(id); id += leg.type === "fork" ? 3 : 1; }
  const finishId = -1;

  const segments = [];
  const seg = (o) => segments.push({
    id: o.id, nameKey: `seg.${o.name}`, seconds: o.seconds,
    stripCount: secondsToStrips(o.seconds),
    checkpointTicks: Math.round(o.seconds * TICK_HZ * 0.9), // ~90% refill @ Medium
    next: o.next, forkLeft: o.forkLeft ?? -1, forkRight: o.forkRight ?? -1,
    curveProfile: o.curveProfile, hillProfile: o.hillProfile,
    trafficSeed: 400 + o.id, scenerySet: o.biome,
  });

  legs.forEach((leg, idx) => {
    const rejoin = idx + 1 < legs.length ? entry[idx + 1] : finishId;
    if (leg.type === "line") {
      seg({ id: entry[idx], name: leg.name, seconds: leg.seconds, next: rejoin, curveProfile: leg.curveProfile, hillProfile: leg.hillProfile, biome: leg.biome });
    } else {
      const forkId = entry[idx], leftId = forkId + 1, rightId = forkId + 2;
      seg({ id: forkId, name: leg.name, seconds: leg.seconds, next: -1, forkLeft: leftId, forkRight: rightId, curveProfile: leg.curveProfile, hillProfile: leg.hillProfile, biome: leg.biome });
      seg({ id: leftId, name: leg.left.name, seconds: leg.left.seconds, next: rejoin, curveProfile: leg.left.curveProfile, hillProfile: leg.left.hillProfile, biome: leg.left.biome });
      seg({ id: rightId, name: leg.right.name, seconds: leg.right.seconds, next: rejoin, curveProfile: leg.right.curveProfile, hillProfile: leg.right.hillProfile, biome: leg.right.biome });
    }
  });
  return segments;
}

function main() {
  const check = process.argv.includes("--check");
  const roads = JSON.parse(readFileSync(roadsPath, "utf8"));

  // Drop any previously-generated course 4 + its segments (ids >= 100) so the
  // build is idempotent, then regenerate.
  roads.segments = roads.segments.filter((s) => s.id < 100);
  roads.courses = roads.courses.filter((c) => c.id !== 4);

  const legs = buildLegs();
  const generated = assemble(legs);
  roads.segments.push(...generated);
  roads.courses.push({ id: 4, nameKey: "course.grand_tour", startSegment: 100 });

  // Validate by loading (throws on any broken edge / bad field).
  loadCourseSet(roads);

  // Report: leg count, total time along the LEFT-fork route, fork/biome summary.
  const segCount = generated.length;
  let mainRouteSecs = 0;
  for (const leg of legs) mainRouteSecs += leg.seconds + (leg.type === "fork" ? leg.left.seconds : 0);

  // Count stages along the main (left-fork) route to the finish.
  const cs = loadCourseSet(roads);
  let sid = 100, stages = 0;
  while (sid !== -1 && stages < 500) {
    const s = generated.find((g) => g.id === sid);
    stages++;
    sid = s.forkLeft >= 0 ? s.forkLeft : s.next;
  }
  console.log(`main route: ${stages} stages`);
  const outOfRange = generated.filter((s) => { const t = stripsToSeconds(s.stripCount); return t < 30 || t > 65; });

  console.log(`grand_tour: ${segCount} segments, ${legs.length} legs, ${legs.filter((l) => l.type === "fork").length} forks`);
  console.log(`left-route total ~${Math.round(mainRouteSecs)}s (~${(mainRouteSecs / 60).toFixed(1)} min) @ Medium cruise`);
  console.log(`biomes: ${[...new Set(generated.map((s) => s.scenerySet))].join(", ")}`);
  if (outOfRange.length) console.log(`WARN: ${outOfRange.length} legs outside 30-65s`);

  if (check) { console.log("(--check: not written)"); return; }
  writeFileSync(roadsPath, JSON.stringify(roads, null, 2) + "\n");
  console.log(`wrote ${roadsPath}`);
}

main();
