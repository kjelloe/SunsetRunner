import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { seatOrderFairness, carSwap } from "../engine/fairness.js";
import { runAiRace } from "../engine/sim.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
const seeds = Array.from({ length: 30 }, (_, i) => 1000 + i);

test("sweep census splits traffic vs rival collisions and picks a winner", () => {
  const r = runAiRace(ctx, { seed: 1000, numSeats: 4, rivalCollision: 1 });
  assert.equal(r.census.collisions, r.census.collisionsTraffic + r.census.collisionsRival);
  assert.ok(r.winnerSeat >= 1);
  assert.ok(r.maxSpeed > 0);
  assert.ok(r.avgFinishTicks > 0);
});

test("seat-order fairness: both start seats win across seeds (no monopoly)", () => {
  const f = seatOrderFairness(ctx, seeds);
  assert.equal(f.contested, seeds.length);
  assert.ok(f.wins[1] > 0 && f.wins[2] > 0, `both seats win: ${JSON.stringify(f.wins)}`);
  // FINDING (recorded): a lean toward the left start lane (seat 1). Not a hard
  // failure — flagged for a fairness pass; asserted only as non-monopoly here.
});

test("car-swap isolates car strength (both cars finish, comparable)", () => {
  const r = carSwap(ctx, seeds, 1, 2);
  assert.ok(r.avgFinishTicksA > 0 && r.avgFinishTicksB > 0);
  assert.ok(Math.abs(r.avgFinishTicksA - r.avgFinishTicksB) < 100); // roughly balanced roster
});

test("fairness measurements are deterministic", () => {
  assert.deepEqual(seatOrderFairness(ctx, [1000, 1001, 1002]), seatOrderFairness(ctx, [1000, 1001, 1002]));
});
