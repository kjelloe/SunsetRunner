import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectPoint } from "../client/projection.js";
import { forwardStrips } from "../client/road_renderer.js";
import { loadCourseSet } from "../shared/road_data.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));
const view = { w: 960, h: 540 };

test("a centered point projects to screen centre-x", () => {
  const p = projectPoint(view, 0, 0, 0, 0, 256);
  assert.equal(p.x, view.w / 2);
});

test("nearer strips project wider than farther strips", () => {
  const near = projectPoint(view, 0, 0, 0, 0, 256);
  const far = projectPoint(view, 0, 0, 0, 0, 2560);
  assert.ok(near.w > far.w, `near ${near.w} should exceed far ${far.w}`);
  assert.ok(near.scale > far.scale);
});

test("camera lateral offset shifts the projected point opposite", () => {
  const centered = projectPoint(view, 0, 0, 0, 0, 256);
  const shifted = projectPoint(view, 500, 0, 0, 0, 256);
  assert.ok(shifted.x < centered.x); // camera moved right -> road slides left
});

test("forwardStrips walks the whole course then stops at finish", () => {
  const total = 600 + 500 + 400; // sunset_coast strip total
  const strips = forwardStrips(courseSet, 1, 0, 2000);
  assert.equal(strips.length, total);
  assert.equal(strips[0].worldZ, 256);
});

test("forwardStrips returns nothing for a finished seat", () => {
  assert.deepEqual(forwardStrips(courseSet, -1, 0, 50), []);
});

test("forwardStrips accumulates curve across the profile", () => {
  // Segment 1's curve only begins past strip ~75 (profile [0,0,1,2,3,...] over
  // 600 strips), so sample deep enough to see curveX bend away from zero.
  const strips = forwardStrips(courseSet, 1, 0, 300);
  assert.notEqual(strips.at(-1).curveX, 0);
});
