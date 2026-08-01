import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { seatOrderFairness, carSwap, mirrorFairness, trafficSwapFairness } from "../engine/fairness.js";
import { runAiRace } from "../engine/sim.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const roadsJson = read("../data/roads.json");
const ctx = {
  courseSet: loadCourseSet(roadsJson),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
const seeds = Array.from({ length: 30 }, (_, i) => 1000 + i);

test("sweep census splits traffic vs rival collisions and picks a winner or tie", () => {
  const r = runAiRace(ctx, { seed: 1000, numSeats: 4, rivalCollision: 1 });
  assert.equal(r.census.collisions, r.census.collisionsTraffic + r.census.collisionsRival);
  assert.ok(r.winnerSeat >= 1 || r.tie); // decisive winner OR an explicit tie
  assert.equal(r.winnerSeat === -1 && r.census.finishes.length > 0, r.tie); // -1 with finishers == tie
  assert.ok(r.maxSpeed > 0);
  assert.ok(r.avgFinishTicks > 0);
});

test("same-tick dead heats are TIES, never awarded to seat 1 (the fixed bug)", () => {
  // Two identical cars in the SAME lane, no traffic, no rival collision -> a
  // guaranteed dead heat. Before the fix this was silently awarded to seat 1
  // (finishes[0]); now it is an explicit tie (winnerSeat -1).
  const noTraffic = { courseSet: ctx.courseSet, carSet: ctx.carSet };
  const r = runAiRace(noTraffic, { seed: 1, seats: [{ id: 1, carId: 1, laneX: 0 }, { id: 2, carId: 1, laneX: 0 }] });
  assert.equal(r.tie, true);
  assert.equal(r.winnerSeat, -1);
  assert.equal(r.census.finishes[0].tick, r.census.finishes[1].tick);
});

test("seat-order fairness with traffic: both seats win decisively (no monopoly)", () => {
  const f = seatOrderFairness(ctx, seeds);
  assert.equal(f.decisive + f.ties, seeds.length);
  assert.ok(f.wins[1] > 0 && f.wins[2] > 0, `both seats win: ${JSON.stringify(f.wins)}`);
  // FINDING (recorded, specs/24): a residual traffic/course lean remains among
  // decisive races — a property of course-1 geometry + traffic on the fixed
  // start lanes, NOT engine unfairness (the engine is proven symmetric by the
  // mirror-fairness test). Asserted only as non-monopoly.
});

test("car-swap isolates car strength (both cars finish, comparable)", () => {
  const r = carSwap(ctx, seeds, 1, 2);
  assert.ok(r.avgFinishTicksA > 0 && r.avgFinishTicksB > 0);
  assert.ok(Math.abs(r.avgFinishTicksA - r.avgFinishTicksB) < 100); // roughly balanced roster
});

test("route-mirror fairness: mirrored branches finish equal, drift opposite", () => {
  // mirror_valley (course 3) has geometrically mirrored branches; with symmetric
  // curve physics (truncDivI32) an accel-only car must finish each in the same
  // time and drift equal-and-opposite. A floored curve divide would fail this.
  const m = mirrorFairness(ctx, 3);
  assert.equal(m.leftFinish, m.rightFinish, "mirrored branches finish in equal time");
  assert.equal(m.leftLaneX, -m.rightLaneX, "drift is equal-and-opposite");
  assert.ok(m.fair);
  assert.notEqual(m.leftLaneX, 0, "the curve actually pushed the car (physics, not cosmetic)");
});

test("traffic-swap fairness: mirror course residual is far smaller than the biased course", () => {
  // On the geometrically-fair mirror course the traffic-seed swap nearly negates
  // the delta (residual small — not exactly 0 now, crash-stun makes it slightly
  // nonlinear; the clean proof is mirrorFairness above). On the asymmetric course
  // the geometry bias survives the swap -> a much larger residual.
  const mirror = trafficSwapFairness(roadsJson, ctx.carSet, ctx.trafficConfig, 3, seeds);
  const asym = trafficSwapFairness(roadsJson, ctx.carSet, ctx.trafficConfig, 2, seeds);
  assert.equal(mirror.forkSegment, 21);
  assert.ok(Math.abs(asym.residual) > 20, `asymmetric course geometry bias survives: ${asym.residual}`);
  assert.ok(Math.abs(mirror.residual) < Math.abs(asym.residual) * 0.6,
    `mirror residual ${mirror.residual} should be well under asymmetric ${asym.residual}`);
});

test("fairness measurements are deterministic", () => {
  assert.deepEqual(seatOrderFairness(ctx, [1000, 1001, 1002]), seatOrderFairness(ctx, [1000, 1001, 1002]));
});
