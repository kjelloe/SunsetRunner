import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createInitialState, makeSeat } from "../engine/state.js";
import { chooseInput } from "../engine/ai_driver.js";
import { runAiRace } from "../engine/sim.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("AI always accelerates and holds a clear lane", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  const inp = chooseInput(state, 1);
  assert.equal(inp.accel, 1);
  assert.equal(inp.brake, 0);
  assert.equal(inp.steer, 0); // centre, no traffic -> hold
});

test("AI dodges away from traffic ahead (symmetric)", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  state.seats[0] = Object.assign(makeSeat(1, 1, 1, 1500), { laneX: 0 });
  state.traffic = [{ id: 99, segmentId: 1, roadZ: 2000, laneX: 100, speed: 500, kind: 1 }];
  assert.equal(chooseInput(state, 1).steer, -1); // traffic to our right -> dodge left
  state.traffic[0].laneX = -100;
  assert.equal(chooseInput(state, 1).steer, 1); // traffic to our left -> dodge right (mirror)
});

test("a finished seat gets a neutral input", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  state.seats[0].finishTicks = 10;
  assert.deepEqual(chooseInput(state, 1), { steer: 0, accel: 0, brake: 0 });
});

test("AI-driven solo race finishes and is pinned (JS-only golden)", () => {
  const r = runAiRace(ctx, { seed: 12345, numSeats: 1 });
  // Position-based forks (marker-0048): the AI's lateral position at the fork now
  // routes it into the RIGHT branch (which grants a checkpoint), so it sees 2
  // checkpoints and finishes later than the old default-left route (was 297/1cp).
  assert.equal(r.lastTick, 316);
  assert.equal(r.census.finishes.length, 1);
  assert.equal(r.census.checkpoints, 2);
  assert.equal(r.finalHash, "946a2c0bc4652aab");
  assert.equal(runAiRace(ctx, { seed: 12345, numSeats: 1 }).finalHash, r.finalHash); // deterministic
});
