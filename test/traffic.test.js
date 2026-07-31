import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { spawnSegmentTraffic, advanceTraffic } from "../engine/traffic.js";
import { ROAD_UNIT } from "../shared/constants.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));
const cfg = loadTrafficConfig(JSON.parse(readFileSync(new URL("../data/traffic.json", import.meta.url))));

function emptyState() {
  return { traffic: [], spawnedSegments: [], nextTrafficId: 1 };
}

test("traffic config loads and rejects a bad kind speed", () => {
  assert.equal(cfg.density, 4);
  assert.throws(() => loadTrafficConfig({ density: 1, lanes: [0], kinds: [{ id: 1, nameKey: "x", speed: 0 }] }), /speed must be positive/);
});

test("spawn is segment-seeded and reproducible", () => {
  const a = emptyState();
  const b = emptyState();
  spawnSegmentTraffic(a, courseSet, cfg, 1);
  spawnSegmentTraffic(b, courseSet, cfg, 1);
  assert.deepEqual(a.traffic, b.traffic);
  assert.equal(a.traffic.length, cfg.density);
});

test("different segments spawn different traffic (distinct seeds)", () => {
  const a = emptyState();
  spawnSegmentTraffic(a, courseSet, cfg, 1);
  const seg1 = a.traffic.map((t) => t.roadZ);
  const b = emptyState();
  spawnSegmentTraffic(b, courseSet, cfg, 2);
  const seg2 = b.traffic.map((t) => t.roadZ);
  assert.notDeepEqual(seg1, seg2);
});

test("spawned cars sit inside their segment and known lanes/kinds", () => {
  const s = emptyState();
  spawnSegmentTraffic(s, courseSet, cfg, 1);
  const segLen = getSegment(courseSet, 1).stripCount * ROAD_UNIT;
  for (const t of s.traffic) {
    assert.ok(t.roadZ >= 0 && t.roadZ < segLen);
    assert.ok(cfg.lanes.includes(t.laneX));
    assert.ok(cfg.kindsById.has(t.kind));
  }
});

test("spawn happens once per segment (guarded)", () => {
  const s = emptyState();
  spawnSegmentTraffic(s, courseSet, cfg, 1);
  spawnSegmentTraffic(s, courseSet, cfg, 1);
  assert.equal(s.traffic.length, cfg.density);
  assert.deepEqual(s.spawnedSegments, [1]);
});

test("advanceTraffic moves cars forward and despawns those off the end", () => {
  const s = emptyState();
  spawnSegmentTraffic(s, courseSet, cfg, 3); // shortest segment (400 strips)
  const segLen = getSegment(courseSet, 3).stripCount * ROAD_UNIT;
  const before = s.traffic.map((t) => t.roadZ);
  advanceTraffic(s, courseSet);
  s.traffic.forEach((t, i) => assert.ok(t.roadZ > before[i] - segLen));
  // push everything past the end and confirm they despawn
  s.traffic.forEach((t) => { t.roadZ = segLen; });
  advanceTraffic(s, courseSet);
  assert.equal(s.traffic.length, 0);
});
