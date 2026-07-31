// debugging/sim_campaign.mjs — the AI-only "do systems fire?" gate (§15.4).
// Runs a field of AI drivers across pinned seeds and prints an event census.
//   node debugging/sim_campaign.mjs [numSeats] [maxTicks]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runCampaign } from "../engine/sim.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const ctx = {
  courseSet: (await import("../shared/road_data.js")).loadCourseSet(read("data/roads.json")),
  carSet: (await import("../shared/car_data.js")).loadCarSet(read("data/cars.json")),
  trafficConfig: (await import("../shared/traffic_data.js")).loadTrafficConfig(read("data/traffic.json")),
};

const numSeats = Number(process.argv[2]) || 6;
const maxTicks = Number(process.argv[3]) || 6000;
const seeds = [1001, 1002, 1003, 1004, 1005];
const results = runCampaign(ctx, { seeds, numSeats, rivalCollision: 1, maxTicks });

console.log(`AI campaign — ${numSeats} cars, seeds ${seeds.join(",")}`);
console.log("seed     finishes  checkpoints  collisions  timeouts  endTick  hash");
for (const r of results) {
  console.log(
    `${String(r.seed).padEnd(8)} ${String(r.census.finishes.length).padEnd(9)} ` +
    `${String(r.census.checkpoints).padEnd(12)} ${String(r.census.collisions).padEnd(11)} ` +
    `${String(r.census.timeouts).padEnd(9)} ${String(r.lastTick).padEnd(8)} ${r.finalHash}`
  );
}

const fired = {
  finish: results.some((r) => r.census.finishes.length),
  checkpoint: results.some((r) => r.census.checkpoints),
  collision: results.some((r) => r.census.collisions),
  timeout: results.some((r) => r.census.timeouts),
};
console.log("systems fired:", JSON.stringify(fired));
const seedInert = new Set(results.map((r) => r.finalHash)).size === 1;
if (seedInert) console.log("NOTE: all seeds identical — race seed is inert (traffic is segment-seeded).");
