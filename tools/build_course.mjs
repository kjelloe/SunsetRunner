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
const CURVES = {
  straight: [0, 0, 0],
  gentleL: [0, -1, -1, 0],
  gentleR: [0, 1, 1, 0],
  sharpL: [0, -1, -2, -2, -1, 0],
  sharpR: [0, 1, 2, 2, 1, 0],
  ess: [0, 1, 2, 0, -2, -1, 0],
};
const HILLS = {
  flat: [0, 0, 0],
  crest: [0, 1, 2, 3, 2, 1, 0],
  dip: [0, -1, -2, -1, 0],
  rolling: [0, 1, 0, -1, 0, 1, 0],
};
const CURVE_CYCLE = ["straight", "gentleR", "ess", "gentleL", "sharpR", "straight", "sharpL"];
const HILL_CYCLE = ["flat", "crest", "rolling", "dip", "flat", "rolling"];
const SEC_CYCLE = [35, 45, 55, 40, 50, 38, 48];

// Biome bands (scenerySet ids from specs/42 + city/night added in scenery.json).
// Tuned so the MAIN (left-fork) route is exactly 50 stages: 44 line legs (1
// stage each) + 3 fork legs (fork segment + left branch = 2 stages each) = 50.
const BANDS = [
  { biome: 1, name: "sunset", n: 7 },
  { biome: 2, name: "beach", n: 9, forkIdx: 4, detour: 3 },
  { biome: 3, name: "canyon", n: 9, forkIdx: 5, detour: 6 },
  { biome: 4, name: "forest", n: 7 },
  { biome: 5, name: "city", n: 9, forkIdx: 4, detour: 6 },
  { biome: 6, name: "night", n: 6 },
];

// Flatten bands into an ordered list of "legs"; a leg is a line or a fork.
function buildLegs() {
  const legs = [];
  let k = 0;
  for (const band of BANDS) {
    for (let i = 0; i < band.n; i++) {
      const seconds = SEC_CYCLE[k % SEC_CYCLE.length];
      const curve = CURVE_CYCLE[k % CURVE_CYCLE.length];
      const hill = HILL_CYCLE[k % HILL_CYCLE.length];
      const base = { name: `${band.name}_${i + 1}`, biome: band.biome, seconds, curve, hill };
      if (band.forkIdx === i) {
        // A fork: two branches (current biome vs a detour biome) that rejoin.
        legs.push({
          type: "fork", ...base,
          left: { name: `${band.name}_${i + 1}L`, biome: band.biome, seconds: seconds + 5, curve: "sharpL", hill: "crest" },
          right: { name: `${band.name}_${i + 1}R`, biome: band.detour, seconds: seconds + 10, curve: "sharpR", hill: "dip" },
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
    curveProfile: CURVES[o.curve], hillProfile: HILLS[o.hill],
    trafficSeed: 400 + o.id, scenerySet: o.biome,
  });

  legs.forEach((leg, idx) => {
    const rejoin = idx + 1 < legs.length ? entry[idx + 1] : finishId;
    if (leg.type === "line") {
      seg({ id: entry[idx], name: leg.name, seconds: leg.seconds, next: rejoin, curve: leg.curve, hill: leg.hill, biome: leg.biome });
    } else {
      const forkId = entry[idx], leftId = forkId + 1, rightId = forkId + 2;
      seg({ id: forkId, name: leg.name, seconds: leg.seconds, next: -1, forkLeft: leftId, forkRight: rightId, curve: leg.curve, hill: leg.hill, biome: leg.biome });
      seg({ id: leftId, name: leg.left.name, seconds: leg.left.seconds, next: rejoin, curve: leg.left.curve, hill: leg.left.hill, biome: leg.left.biome });
      seg({ id: rightId, name: leg.right.name, seconds: leg.right.seconds, next: rejoin, curve: leg.right.curve, hill: leg.right.hill, biome: leg.right.biome });
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
