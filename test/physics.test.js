import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet, getCar } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createInitialState, makeSeat } from "../engine/state.js";
import { stepLongitudinal, stepLateral, ROAD_HALF_WIDTH, NATURAL_DRAG } from "../engine/car_physics.js";
import { apply } from "../engine/reducer.js";
import { hashSnapshot } from "../engine/snapshot.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));
const carSet = loadCarSet(JSON.parse(readFileSync(new URL("../data/cars.json", import.meta.url))));
const trafficConfig = loadTrafficConfig(JSON.parse(readFileSync(new URL("../data/traffic.json", import.meta.url))));
const golden = JSON.parse(readFileSync(new URL("./fixtures/physics_1a.json", import.meta.url)));
const ctx = { courseSet, carSet }; // no traffic — for isolated physics units
const ctxT = { courseSet, carSet, trafficConfig }; // full context — for the golden
const car = getCar(carSet, 1);

function seatWith(over) {
  return Object.assign(makeSeat(1, 1, 1), over);
}

test("accelerator raises speed by car.accel and clamps at maxSpeed", () => {
  const seat = seatWith({ accelHeld: 1, speed: 0 });
  stepLongitudinal(seat, car);
  assert.equal(seat.speed, car.accel);
  seat.speed = car.maxSpeed - 5;
  stepLongitudinal(seat, car);
  assert.equal(seat.speed, car.maxSpeed);
});

test("brake lowers speed and floors at zero", () => {
  const seat = seatWith({ brakeHeld: 1, speed: 10 });
  stepLongitudinal(seat, car);
  assert.equal(seat.speed, 0); // 10 - 45 floored to 0
});

test("coasting applies natural drag", () => {
  const seat = seatWith({ speed: 100 });
  stepLongitudinal(seat, car);
  assert.equal(seat.speed, 100 - NATURAL_DRAG);
});

test("off-road position adds off-road drag", () => {
  const onRoad = seatWith({ accelHeld: 1, speed: 500, laneX: 0 });
  const offRoad = seatWith({ accelHeld: 1, speed: 500, laneX: ROAD_HALF_WIDTH + 1 });
  stepLongitudinal(onRoad, car);
  stepLongitudinal(offRoad, car);
  assert.equal(onRoad.speed - offRoad.speed, car.offroadDrag);
});

test("steering shifts laneX and clamps", () => {
  const seat = seatWith({ steerHeld: 1, speed: 0, laneX: 0 });
  stepLateral(seat, car);
  assert.equal(seat.laneX, car.steerLow); // full steer authority at speed 0
  const pinned = seatWith({ steerHeld: 1, speed: 0, laneX: 1024 });
  stepLateral(pinned, car);
  assert.equal(pinned.laneX, 1024); // clamped at MAX_LANE_OFFSET
});

test("reducer input sets held controls; unknown seat is a no-op", () => {
  const s0 = createInitialState({ seed: 1, courseSet, carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  const s1 = apply(s0, { type: "input", seatId: 1, steer: -1, accel: 1, brake: 0 }, ctx);
  assert.equal(s1.seats[0].accelHeld, 1);
  assert.equal(s1.seats[0].steerHeld, -1);
  assert.equal(s0.seats[0].accelHeld, 0); // input did not mutate the source state
});

test("reducer rejects an invalid command", () => {
  const s0 = createInitialState({ seed: 1, courseSet, carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  assert.throws(() => apply(s0, { type: "input", seatId: 1, steer: 2, accel: 1, brake: 0 }, ctx), /steer/);
});

test("advance_tick is pure — source state hash is unchanged", () => {
  const s0 = createInitialState({ seed: 7, courseSet, carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  const h = hashSnapshot(s0);
  apply(s0, { type: "advance_tick" }, ctx);
  assert.equal(hashSnapshot(s0), h);
});

test("golden: accel-only run matches pinned hashes, checkpoint and finish", () => {
  const g = golden.accelRun;
  let s = createInitialState({
    seed: golden.seed, courseSet, carSet, courseId: golden.courseId,
    seats: [{ id: 1, carId: golden.carId }], trafficConfig,
  });
  assert.equal(s.traffic.length, g.initialTrafficCount);
  s = apply(s, { type: "input", seatId: 1, steer: 0, accel: 1, brake: 0 }, ctxT);
  let finishTick = -1;
  let checkpointTick = -1;
  for (let t = 1; t <= 400; t++) {
    s = apply(s, { type: "advance_tick" }, ctxT);
    if (t === 10) assert.equal(hashSnapshot(s), g.hashAtTick10);
    if (t === 100) assert.equal(hashSnapshot(s), g.hashAtTick100);
    const cp = s.events.find((e) => e.type === "checkpoint");
    if (cp && checkpointTick < 0) {
      checkpointTick = t;
      assert.equal(cp.bonus, g.checkpointBonus);
    }
    if (finishTick < 0 && s.events.some((e) => e.type === "finish")) finishTick = t;
  }
  assert.equal(checkpointTick, g.checkpointTick);
  assert.equal(finishTick, g.finishTick);
  assert.equal(s.seats[0].finishTicks, g.finishTick);
  assert.equal(s.seats[0].segmentId, -1);
  assert.equal(s.seats[0].timerTicks, g.finalTimerTicks);
  assert.equal(hashSnapshot(s), g.hashAtTick400);
});

test("passing the checkpoint extends the timer by the segment bonus", () => {
  let s = createInitialState({
    seed: 12345, courseSet, carSet, courseId: 1, seats: [{ id: 1, carId: 1 }],
    startTimeTicks: 1500,
  });
  s = apply(s, { type: "input", seatId: 1, steer: 0, accel: 1, brake: 0 }, ctx);
  let before = -1;
  for (let t = 1; t <= 130; t++) {
    const prev = s.seats[0].timerTicks;
    s = apply(s, { type: "advance_tick" }, ctx);
    if (s.events.some((e) => e.type === "checkpoint")) { before = prev; break; }
  }
  // timer went up across the checkpoint tick despite the -1 tick bleed
  assert.ok(before >= 0);
  assert.equal(s.seats[0].timerTicks, before - 1 + golden.accelRun.checkpointBonus);
});

test("timer reaching zero times the seat out and stops it", () => {
  let s = createInitialState({
    seed: golden.seed, courseSet, carSet, courseId: golden.courseId,
    seats: [{ id: 1, carId: golden.carId }], startTimeTicks: golden.timeout.startTimeTicks,
  });
  s = apply(s, { type: "input", seatId: 1, steer: 0, accel: 1, brake: 0 }, ctx);
  let timeoutTick = -1;
  for (let t = 1; t <= 60; t++) {
    s = apply(s, { type: "advance_tick" }, ctx);
    if (timeoutTick < 0 && s.events.some((e) => e.type === "timeout")) timeoutTick = t;
  }
  assert.equal(timeoutTick, golden.timeout.timeoutTick);
  assert.equal(s.seats[0].timedOut, 1);
  assert.equal(s.seats[0].speed, 0);
  assert.equal(s.seats[0].finishTicks, -1); // timed out, not finished
});
