import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { ROAD_UNIT } from "../shared/constants.js";
import { loadScenery } from "../client/scenery.js";
import { forkAhead, secondsToFork, branchName, drawForkPreview } from "../client/fork_preview.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const courseSet = loadCourseSet(read("../data/roads.json"));
const scenery = loadScenery(read("../data/scenery.json"));
const segLen = (id) => getSegment(courseSet, id).stripCount * ROAD_UNIT;

test("forkAhead finds the upcoming fork from the segment before it", () => {
  const fa = forkAhead(courseSet, { segmentId: 2, roadZ: segLen(2) - 1, speed: 500 });
  assert.equal(fa.forkSegId, 3);
  assert.equal(fa.left, 4);
  assert.equal(fa.right, 5);
  assert.ok(fa.distance > segLen(3)); // remaining of seg 2 + all of fork seg 3
});

test("forkAhead measures distance to the split while inside the fork segment", () => {
  const fa = forkAhead(courseSet, { segmentId: 3, roadZ: 1000, speed: 500 });
  assert.equal(fa.forkSegId, 3);
  assert.equal(fa.distance, segLen(3) - 1000);
});

test("forkAhead is null when no fork is near", () => {
  assert.equal(forkAhead(courseSet, { segmentId: 1, roadZ: 0, speed: 500 }), null);
  assert.equal(forkAhead(courseSet, { segmentId: -1, roadZ: 0, speed: 0 }), null);
});

test("secondsToFork uses speed, Infinity when stopped", () => {
  assert.equal(secondsToFork(20000, 0), Infinity);
  assert.ok(secondsToFork(20000, 500) > 0);
});

test("branchName reads the branch's scenery theme", () => {
  assert.equal(branchName(scenery, courseSet, 4), "BEACH");
  assert.equal(branchName(scenery, courseSet, 5), "CANYON");
});

function recorder() {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "font", "textAlign", "textBaseline"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  return { g, calls };
}

test("drawForkPreview paints when close, stays silent when far", () => {
  const near = recorder();
  drawForkPreview(near.g, { w: 960, h: 540 }, { segmentId: 3, roadZ: segLen(3) - 1000, speed: 500, laneX: -100 }, courseSet, scenery);
  assert.ok(near.calls.includes("fillText"));

  const far = recorder();
  drawForkPreview(far.g, { w: 960, h: 540 }, { segmentId: 1, roadZ: 0, speed: 500, laneX: 0 }, courseSet, scenery);
  assert.equal(far.calls.length, 0);
});
