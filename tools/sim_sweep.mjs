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
import { runAiRace, rosterSeats } from "../engine/sim.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const ctx = {
  courseSet: loadCourseSet(read("data/roads.json")),
  carSet: loadCarSet(read("data/cars.json")),
  trafficConfig: loadTrafficConfig(read("data/traffic.json")),
};

const N = Number(process.argv[2]) || 50;
const numSeats = Number(process.argv[3]) || 6;
const courseId = Number(process.argv[4]) || 1;
const rivalCollision = process.env.RIVAL !== "0";

// Whole roster, so winnerCar actually varies. Rotate the car→lane assignment
// per race so no car is permanently glued to the pole lane — otherwise a lane
// advantage would masquerade as a car advantage (analyze_sweep reads winnerCar).
const roster = ctx.carSet.cars.map((c) => c.id);

const cols = [
  "seed", "courseId", "numSeats", "winnerSeat", "winnerCar", "finishCount",
  "timeoutCount", "avgFinishTicks", "collisionsTraffic", "collisionsRival",
  "maxSpeed", "resultHash",
];
console.log(cols.join(","));
for (let i = 0; i < N; i++) {
  const seed = 1000 + i;
  const rot = i % roster.length;
  const cars = roster.slice(rot).concat(roster.slice(0, rot));
  const seats = rosterSeats(numSeats, cars);
  const r = runAiRace(ctx, { seed, seats, rivalCollision, courseId });
  console.log([
    seed, courseId, numSeats, r.winnerSeat, r.winnerCar, r.census.finishes.length,
    r.census.timeouts, r.avgFinishTicks, r.census.collisionsTraffic,
    r.census.collisionsRival, r.maxSpeed, r.finalHash,
  ].join(","));
}
