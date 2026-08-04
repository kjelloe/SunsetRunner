import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createLocalSession } from "../client/session_local.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const courseSet = loadCourseSet(read("../data/roads.json"));
const carSet = loadCarSet(read("../data/cars.json"));
const trafficConfig = loadTrafficConfig(read("../data/traffic.json"));

function session(aiCount) {
  return createLocalSession(courseSet, carSet, { seed: 1, courseId: 1, startTimeTicks: 3000, trafficConfig, carId: 1, aiCount });
}

test("solo AI opponents appear as named ghosts", () => {
  const s = session(3);
  const g = s.getState().ghosts;
  assert.equal(g.length, 3);
  assert.ok(g.every((r) => typeof r.name === "string" && r.name.length > 0));
  assert.ok(new Set(g.map((r) => r.seatId)).size === 3);
});

test("AI opponents drive forward", () => {
  const s = session(2);
  s.setInput({ steer: 0, accel: 1, brake: 0 });
  for (let i = 0; i < 40; i++) s.tick();
  const g = s.getState().ghosts;
  assert.ok(g.some((r) => r.roadZ > 0), "an AI advanced");
});

test("local AI race is deterministic", () => {
  const a = session(4); const b = session(4);
  a.setInput({ steer: 0, accel: 1, brake: 0 });
  b.setInput({ steer: 0, accel: 1, brake: 0 });
  for (let i = 0; i < 30; i++) { a.tick(); b.tick(); }
  assert.deepEqual(a.getState().ghosts, b.getState().ghosts);
});

test("aiCount 0 = solo, no ghosts", () => {
  assert.equal(session(0).getState().ghosts.length, 0);
});
