// debugging/fairness.mjs — fairness report (§16): seat-order + car-swap over N
// seeds. For a real balance read use 300+ seeds.
//   node debugging/fairness.mjs [N]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { seatOrderFairness, carSwap, mirrorFairness } from "../engine/fairness.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const ctx = {
  courseSet: loadCourseSet(read("data/roads.json")),
  carSet: loadCarSet(read("data/cars.json")),
  trafficConfig: loadTrafficConfig(read("data/traffic.json")),
};

const N = Number(process.argv[2]) || 40;
const seeds = Array.from({ length: N }, (_, i) => 1000 + i);

const seat = seatOrderFairness(ctx, seeds);
console.log(`seat-order fairness over ${N} seeds (2 identical cars, mirror lanes):`);
console.log(`  wins ${JSON.stringify(seat.wins)} of ${seat.contested} contested`);
const w1 = seat.wins[1] || 0;
if (Math.abs(w1 - seat.contested / 2) > seat.contested * 0.2) {
  console.log(`  NOTE: skew toward seat ${w1 > seat.contested / 2 ? 1 : 2} — investigate start-lane/seat-order bias.`);
}

const cs = carSwap(ctx, seeds, 1, 2);
console.log(`car-swap car ${cs.carA} vs ${cs.carB} (avg finish tick, lower=faster):`);
console.log(`  car ${cs.carA}: ${cs.avgFinishTicksA}   car ${cs.carB}: ${cs.avgFinishTicksB}`);

const mv = mirrorFairness(ctx, 3);
console.log(`route-mirror fairness (course 3 mirror_valley, no traffic):`);
console.log(`  left finish ${mv.leftFinish} / right ${mv.rightFinish}; drift ${mv.leftLaneX} / ${mv.rightLaneX} -> ${mv.fair ? "FAIR" : "BIASED"}`);
