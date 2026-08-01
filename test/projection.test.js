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

test("road projects BELOW the horizon, nearer strips lower on screen", () => {
  // Regression for the flipped-camera bug (road drawn up in the sky). Road
  // points (worldY≈0) must land at y >= h/2, and nearer road lower than far.
  const near = projectPoint(view, 0, 0, 0, 0, 512);
  const far = projectPoint(view, 0, 0, 0, 0, 20000);
  assert.ok(far.y >= view.h / 2, `road must sit at/below horizon, got ${far.y}`);
  assert.ok(near.y > far.y, `nearer road must be lower on screen (${near.y} > ${far.y})`);
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
