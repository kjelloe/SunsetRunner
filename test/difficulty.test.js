import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_ADVANCE_TICK } from "../engine/commands.js";
import { ROAD_UNIT, DIFFICULTY } from "../shared/constants.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const courseSet = loadCourseSet(read("../data/roads.json"));
const carSet = loadCarSet(read("../data/cars.json"));

// The checkpoint bonus awarded on entering seg 2 (checkpointTicks 600) under a
// given difficulty timeScale.
function seg2Bonus(timeScale) {
  const s0 = createInitialState({
    seed: 1, courseSet, carSet, courseId: 1,
    seats: [{ id: 1, carId: 1 }], startTimeTicks: 5000,
  });
  s0.seats[0].roadZ = getSegment(courseSet, 1).stripCount * ROAD_UNIT - 1;
  s0.seats[0].speed = ROAD_UNIT; // guaranteed to cross into seg 2 this tick
  const ctx = timeScale == null ? { courseSet, carSet } : { courseSet, carSet, timeScale };
  const s1 = apply(s0, { type: CMD_ADVANCE_TICK }, ctx);
  const cp = s1.events.find((e) => e.type === "checkpoint" && e.segmentId === 2);
  return cp ? cp.bonus : 0;
}

test("medium (or no timeScale) is identity — the raw checkpointTicks", () => {
  assert.equal(seg2Bonus(undefined), 600);
  assert.equal(seg2Bonus(DIFFICULTY.medium), 600);
});

test("easy grants more time, hard grants less", () => {
  assert.equal(seg2Bonus(DIFFICULTY.easy), 780); // 600 * 130 / 100
  assert.equal(seg2Bonus(DIFFICULTY.hard), 450); // 600 * 75 / 100
  assert.ok(seg2Bonus(DIFFICULTY.easy) > seg2Bonus(DIFFICULTY.medium));
  assert.ok(seg2Bonus(DIFFICULTY.hard) < seg2Bonus(DIFFICULTY.medium));
});
