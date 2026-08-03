import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { ROAD_UNIT } from "../shared/constants.js";
import { forwardStrips, drawRoad } from "../client/road_renderer.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));

test("forwardStrips splits into two diverging branches past a fork", () => {
  const fork = getSegment(courseSet, 11); // canyon_split fork -> 12 / 13
  const startZ = (fork.stripCount - 5) * ROAD_UNIT; // just before the split
  const strips = forwardStrips(courseSet, 11, startZ, 80);
  const forked = strips.filter((s) => s.forkLeftCurveX != null);
  assert.ok(forked.length > 0, "some strips are past the split");
  const gaps = forked.map((s) => s.forkRightCurveX - s.forkLeftCurveX);
  assert.ok(gaps.every((g) => g > 0), "right branch is right of left branch");
  assert.ok(gaps[gaps.length - 1] > gaps[0], "the branches diverge with distance");
});

test("no fork fields before a fork", () => {
  const strips = forwardStrips(courseSet, 1, 0, 40); // seg 1 is long and linear
  assert.ok(strips.every((s) => s.forkLeftCurveX == null));
});

test("drawRoad renders a forked road without throwing", () => {
  const fork = getSegment(courseSet, 11);
  const seat = { segmentId: 11, roadZ: (fork.stripCount - 5) * ROAD_UNIT };
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "strokeStyle", "lineWidth"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  drawRoad(g, { w: 960, h: 540 }, seat, courseSet, 0);
  assert.ok(calls.includes("fillRect"));
});
