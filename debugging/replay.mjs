// debugging/replay.mjs — run a scenario fixture and print a human race report
// (replay as bug report, §21.2). No assertions — for eyeballing a run.
//   node debugging/replay.mjs [test/fixtures/checkpoint_1a.json]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runScenario } from "../engine/scenario.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const fixturePath = process.argv[2] || "test/fixtures/checkpoint_1a.json";
const fixture = read(fixturePath);
const ctx = {
  courseSet: loadCourseSet(read("data/roads.json")),
  carSet: loadCarSet(read("data/cars.json")),
  trafficConfig: loadTrafficConfig(read("data/traffic.json")),
};

const r = runScenario(fixture.scenario, ctx);
const seat = r.state.seats[0];
console.log(`scenario: ${fixture.scenario.name} (seed ${fixture.scenario.seed})`);
console.log(`ended tick ${r.lastTick} · finalHash ${r.finalHash}`);
console.log(`seat: segment ${seat.segmentId} · finishTicks ${seat.finishTicks} · timedOut ${seat.timedOut} · timer ${seat.timerTicks}`);
console.log(`census: ${r.census.map((e) => `${e.type}@${e.tick}`).join(", ") || "(none)"}`);
console.log(`traffic still live: ${r.state.traffic.length}`);
