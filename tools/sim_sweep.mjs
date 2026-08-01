// tools/sim_sweep.mjs — balance sweep battery (§15.5). Runs N seeds through an
// AI field and emits CSV to stdout. For balance use 300+ runs, not 5.
//   node tools/sim_sweep.mjs [N] [numSeats]
// Env: RIVAL=0 to disable rival collision.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runAiRace } from "../engine/sim.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const ctx = {
  courseSet: loadCourseSet(read("data/roads.json")),
  carSet: loadCarSet(read("data/cars.json")),
  trafficConfig: loadTrafficConfig(read("data/traffic.json")),
};

const N = Number(process.argv[2]) || 50;
const numSeats = Number(process.argv[3]) || 6;
const rivalCollision = process.env.RIVAL !== "0";

const cols = [
  "seed", "courseId", "numSeats", "winnerSeat", "winnerCar", "finishCount",
  "timeoutCount", "avgFinishTicks", "collisionsTraffic", "collisionsRival",
  "maxSpeed", "resultHash",
];
console.log(cols.join(","));
for (let i = 0; i < N; i++) {
  const seed = 1000 + i;
  const r = runAiRace(ctx, { seed, numSeats, rivalCollision, courseId: 1 });
  console.log([
    seed, 1, numSeats, r.winnerSeat, r.winnerCar, r.census.finishes.length,
    r.census.timeouts, r.avgFinishTicks, r.census.collisionsTraffic,
    r.census.collisionsRival, r.maxSpeed, r.finalHash,
  ].join(","));
}
