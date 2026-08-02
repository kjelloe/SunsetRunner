import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectPoint } from "../client/projection.js";
import { forwardStrips } from "../client/road_renderer.js";
import { onRoad } from "../client/renderer_canvas.js";
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
  // sunset_coast default-left path: 1(500) -> 2(400) -> 3 fork -> 4(400) -> 6(300)
  const total = 500 + 400 + 200 + 400 + 300;
  const strips = forwardStrips(courseSet, 1, 0, 3000);
  assert.equal(strips.length, total);
  assert.equal(strips[0].worldZ, 256);
});

test("forwardStrips returns nothing for a finished seat", () => {
  assert.deepEqual(forwardStrips(courseSet, -1, 0, 50), []);
});

test("road SCROLLS: the nearest strip slides toward the camera as the car advances", () => {
  // Advancing within a strip (roadZ 0 -> 100, same strip) must shrink the nearest
  // strip's worldZ (it moves toward the camera) — the fix for "feels like standing
  // still". worldStrip (band phase) is unchanged until a strip boundary is crossed.
  const a = forwardStrips(courseSet, 1, 0, 5);
  const b = forwardStrips(courseSet, 1, 100, 5);
  assert.ok(b[0].worldZ < a[0].worldZ, `nearest strip should move nearer (${b[0].worldZ} < ${a[0].worldZ})`);
  assert.equal(b[0].worldStrip, a[0].worldStrip);
});

test("crossing a strip boundary advances worldStrip (bands/scenery scroll)", () => {
  const a = forwardStrips(courseSet, 1, 0, 5);
  const c = forwardStrips(courseSet, 1, 300, 5); // 300 > ROAD_UNIT(256) -> next strip
  assert.equal(c[0].worldStrip, a[0].worldStrip + 1);
});

test("onRoad: laneX 0 = centre, ROAD_HALF_WIDTH = road edge, narrows with distance", () => {
  const centre = onRoad(view, 0, 2000, 0);
  const edge = onRoad(view, 0, 2000, 512); // ROAD_HALF_WIDTH
  assert.equal(centre.x, view.w / 2);
  assert.ok(Math.abs((edge.x - centre.x) - edge.half) < 1, "edge is one road-half from centre");
  assert.ok(edge.half > 20, `road must have real on-screen width, got ${edge.half}`); // sprites won't be sub-pixel
  const far = onRoad(view, 0, 5000, 512);
  assert.ok(far.half < edge.half, "road narrows with distance");
});

test("onRoad follows the road curve — curveX bends entity placement", () => {
  // Traffic/scenery must ride the curved centreline, not a straight column.
  const straight = onRoad(view, 0, 2000, 0, 0);
  const curvedRight = onRoad(view, 0, 2000, 0, 3000);
  const curvedLeft = onRoad(view, 0, 2000, 0, -3000);
  assert.ok(curvedRight.x > straight.x, "positive curveX shifts placement right");
  assert.ok(curvedLeft.x < straight.x, "negative curveX shifts placement left");
});

test("forwardStrips accumulates curve across the profile", () => {
  // Segment 1's curve only begins past strip ~75 (profile [0,0,1,2,3,...] over
  // 600 strips), so sample deep enough to see curveX bend away from zero.
  const strips = forwardStrips(courseSet, 1, 0, 300);
  assert.notEqual(strips.at(-1).curveX, 0);
});
