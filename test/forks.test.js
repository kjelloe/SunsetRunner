import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { runScenario } from "../engine/scenario.js";
import { advanceRoad } from "../engine/road_progress.js";
import { ROAD_UNIT } from "../shared/constants.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
const fixture = read("./fixtures/fork_1a.json");

function forkScenario(choice) {
  const base = fixture.scenario;
  return { ...base, forkChoices: choice === 0 ? [] : [{ tick: 5, seatId: 1, choice }] };
}

test("forkChoice command sets the seat's pending choice", () => {
  const s0 = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 2, seats: [{ id: 1, carId: 1 }] });
  const s1 = apply(s0, { type: "forkChoice", seatId: 1, choice: 1 }, ctx);
  assert.equal(s1.seats[0].forkChoice, 1);
  assert.equal(s0.seats[0].forkChoice, 0); // pure
  assert.throws(() => apply(s0, { type: "forkChoice", seatId: 1, choice: 0 }, ctx), /choice must be -1\|1/);
});

test("fork_1a golden: right choice routes through seg 13 and is pinned", () => {
  const r = runScenario(fixture.scenario, ctx);
  for (const t of fixture.scenario.hashTicks) {
    assert.equal(r.hashes[t], fixture.expected.hashes[String(t)], `hash drift at tick ${t}`);
  }
  assert.equal(r.finalHash, fixture.expected.finalHash);
  assert.equal(r.lastTick, fixture.expected.finishTick);
  assert.deepEqual(r.census.map((e) => `${e.type}@${e.tick}`), fixture.expected.census);
});

test("left and right choices take different routes", () => {
  const left = runScenario(forkScenario(-1), ctx);
  const right = runScenario(forkScenario(1), ctx);
  assert.notEqual(left.finalHash, right.finalHash);
  assert.ok(left.state.seats[0].finishTicks > 0 && right.state.seats[0].finishTicks > 0);
});

// A seat parked at the very end of the course-2 fork segment (11 -> {12|13}),
// about to cross into the branch on the next advance.
function seatAtForkEnd(laneX) {
  const seg = getSegment(ctx.courseSet, 11);
  const segLen = seg.stripCount * ROAD_UNIT;
  return { id: 1, segmentId: 11, roadZ: segLen - 1, speed: 4, laneX, forkChoice: 0, finishTicks: -1 };
}

test("with no explicit choice, lane position picks the fork", () => {
  const seg = getSegment(ctx.courseSet, 11);
  const left = seatAtForkEnd(-100);
  advanceRoad(left, ctx.courseSet, 1);
  assert.equal(left.segmentId, seg.forkLeft, "left of centre -> left fork");

  const right = seatAtForkEnd(100);
  advanceRoad(right, ctx.courseSet, 1);
  assert.equal(right.segmentId, seg.forkRight, "right of centre -> right fork");

  const centre = seatAtForkEnd(0);
  advanceRoad(centre, ctx.courseSet, 1);
  assert.equal(centre.segmentId, seg.forkRight, "dead centre -> right fork");
});

test("an explicit Q/E choice overrides lane position", () => {
  const seg = getSegment(ctx.courseSet, 11);
  // Car is right of centre (would take the right fork) but explicitly chose left.
  const s = seatAtForkEnd(300);
  s.forkChoice = -1;
  advanceRoad(s, ctx.courseSet, 1);
  assert.equal(s.segmentId, seg.forkLeft);
});

test("no explicit choice follows lane position (centre car matches right)", () => {
  const right = runScenario(forkScenario(1), ctx);
  const none = runScenario(forkScenario(0), ctx); // stays centre -> right fork
  assert.equal(none.finalHash, right.finalHash);
});
