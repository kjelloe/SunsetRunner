import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runAiRace, rosterSeats } from "../engine/sim.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));

test("roster has 4 distinct cars", () => {
  const cs = loadCarSet(read("data/cars.json"));
  const ids = cs.cars.map((c) => c.id);
  assert.deepEqual(ids, [1, 2, 3, 4]);
  assert.equal(new Set(cs.cars.map((c) => c.nameKey)).size, 4);
});

test("rosterSeats cycles cars across the roster on symmetric lanes", () => {
  const seats = rosterSeats(5, [1, 2, 3]);
  assert.deepEqual(seats.map((s) => s.carId), [1, 2, 3, 1, 2]);
  // Lanes are symmetric about the centre line (they sum to 0).
  assert.equal(seats.reduce((n, s) => n + s.laneX, 0), 0);
});

test("a roster sweep produces more than one distinct winner car (car-swap is live)", () => {
  const ctx = {
    courseSet: loadCourseSet(read("data/roads.json")),
    carSet: loadCarSet(read("data/cars.json")),
    trafficConfig: loadTrafficConfig(read("data/traffic.json")),
  };
  const roster = ctx.carSet.cars.map((c) => c.id);
  const winners = new Set();
  for (let i = 0; i < 24; i++) {
    const rot = i % roster.length;
    const cars = roster.slice(rot).concat(roster.slice(0, rot));
    const r = runAiRace(ctx, { seed: 2000 + i, seats: rosterSeats(8, cars), rivalCollision: true, courseId: 1 });
    if (r.winnerCar > 0) winners.add(r.winnerCar);
  }
  assert.ok(winners.size > 1, `expected varied winners, got ${[...winners]}`);
});

test("analyze_sweep.py computes win shares and flags a dominant car", (t) => {
  // Full 4-car field, car 1 dominant (5/8 = 62% > fair 25% x1.5).
  const header = "seed,courseId,numSeats,winnerSeat,winnerCar,finishCount,timeoutCount,avgFinishTicks,collisionsTraffic,collisionsRival,maxSpeed,resultHash";
  const row = (i, car) => `${i},1,4,1,${car},4,0,300,2,10,2400,h${i}`;
  const csv = [header, ...[1, 1, 1, 1, 1, 2, 3, 4].map((car, i) => row(i, car))].join("\n");
  let out;
  try {
    out = execFileSync("python3", [resolve(root, "tools/analyze_sweep.py")], { input: csv, encoding: "utf8" });
  } catch (e) {
    if (e.code === "ENOENT") return t.skip("python3 not installed");
    throw e;
  }
  assert.match(out, /races=8/);
  assert.match(out, /fairShare=25%/);
  assert.match(out, /car 1: wins=\s*5\s+winShare=62%/);
  assert.match(out, /car 1 win share 62% .* likely too strong/);
});
