import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { BOOST_TICKS, BOOST_SPEED } from "../shared/constants.js";
import { createInitialState, makeSeat } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { stepLongitudinal } from "../engine/car_physics.js";
import { resolveBoostPickups } from "../engine/boost.js";
import { runScenario } from "../engine/scenario.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("stepLongitudinal: boostTicks raises the cap and adds a shove", () => {
  const car = { accel: 100, brake: 100, offroadDrag: 100, maxSpeed: 2400, steerLow: 0, steerHigh: 0 };
  // At the base cap with the gas held: no boost -> stays capped.
  const plain = { laneX: 0, speed: 2400, accelHeld: 1, brakeHeld: 0, boostTicks: 0 };
  stepLongitudinal(plain, car);
  assert.equal(plain.speed, 2400);
  // Boosting: the cap lifts by BOOST_SPEED and the shove pushes toward it.
  const boosted = { laneX: 0, speed: 2400, accelHeld: 1, brakeHeld: 0, boostTicks: 5 };
  stepLongitudinal(boosted, car);
  assert.ok(boosted.speed > 2400, "boost pushes past the base cap");
  assert.ok(boosted.speed <= 2400 + BOOST_SPEED, "but not past the boosted cap");
});

test("resolveBoostPickups: over a data pad sets boostTicks; elsewhere it does not", () => {
  // Segment 100 (grand_tour) has a pad at { roadZ: 5120, laneX: 0 }.
  const state = { seats: [Object.assign(makeSeat(1, 1, 100, 3000), { roadZ: 5120, laneX: 0 })] };
  resolveBoostPickups(state, ctx.courseSet);
  assert.equal(state.seats[0].boostTicks, BOOST_TICKS);
  // Far from the pad: no boost.
  const away = { seats: [Object.assign(makeSeat(1, 1, 100, 3000), { roadZ: 999999, laneX: 0 })] };
  resolveBoostPickups(away, ctx.courseSet);
  assert.equal(away.seats[0].boostTicks, 0);
  // A course with no pads (course 1) never boosts -> goldens stay behaviour-identical.
  const seg1 = { seats: [Object.assign(makeSeat(1, 1, 1, 1500), { roadZ: 0, laneX: 0 })] };
  resolveBoostPickups(seg1, ctx.courseSet);
  assert.equal(seg1.seats[0].boostTicks, 0);
});

test("boost_1a golden: a course-4 run picks up the pad and is pinned", () => {
  const fixture = read("./fixtures/boost_1a.json");
  const r = runScenario(fixture.scenario, ctx);
  for (const t of fixture.scenario.hashTicks) {
    assert.equal(r.hashes[t], fixture.expected.hashes[String(t)], `hash drift at tick ${t}`);
  }
  assert.equal(r.finalHash, fixture.expected.finalHash);
  assert.equal(r.lastTick, fixture.expected.lastTick);
  assert.deepEqual(r.census.map((e) => `${e.type}@${e.tick}`), fixture.expected.census);
});

test("boost_1a actually boosts: speed exceeds the base cap while boosting", () => {
  const fixture = read("./fixtures/boost_1a.json");
  let s = createInitialState({
    seed: fixture.scenario.seed, courseSet: ctx.courseSet, carSet: ctx.carSet,
    courseId: 4, seats: [{ id: 1, carId: 1 }], startTimeTicks: 3000, trafficConfig: ctx.trafficConfig,
  });
  s = apply(s, { type: "input", seatId: 1, steer: 0, accel: 1, brake: 0 }, ctx);
  const baseCap = ctx.carSet.cars[0].maxSpeed;
  let boosted = false, overCap = false;
  for (let t = 1; t <= 80; t++) {
    s = apply(s, { type: "advance_tick" }, ctx);
    if (s.seats[0].boostTicks > 0) boosted = true;
    if (s.seats[0].speed > baseCap) overCap = true;
  }
  assert.ok(boosted, "the run picked up a boost pad");
  assert.ok(overCap, "boost let the car exceed its normal top speed");
});
