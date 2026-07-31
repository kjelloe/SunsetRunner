// tools/repin_checkpoint_1a.mjs — re-pin the checkpoint_1a milestone fixture.
// Repin is a CONSCIOUS act: pass a reason. It re-runs the scenario, prints the
// event census (so drift is visible), and writes the expected block back.
//   node tools/repin_checkpoint_1a.mjs "why this changed"
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runScenario } from "../engine/scenario.js";

const reason = process.argv[2];
if (!reason) {
  console.error('refusing to repin without a reason.\n  usage: node tools/repin_checkpoint_1a.mjs "why this changed"');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p)));
const ctx = {
  courseSet: loadCourseSet(read("data/roads.json")),
  carSet: loadCarSet(read("data/cars.json")),
  trafficConfig: loadTrafficConfig(read("data/traffic.json")),
};

const fixturePath = resolve(root, "test/fixtures/checkpoint_1a.json");
const fixture = read("test/fixtures/checkpoint_1a.json");
const r = runScenario(fixture.scenario, ctx);

const expected = {
  hashes: r.hashes,
  finalHash: r.finalHash,
  finishTick: r.census.find((e) => e.type === "finish")?.tick ?? -1,
  census: r.census,
};

console.log(`repin reason: ${reason}`);
console.log("event census:", JSON.stringify(r.census));
console.log("finalHash:", r.finalHash, "lastTick:", r.lastTick);

fixture.expected = expected;
fixture.note = `checkpoint_1a milestone fixture. Last repinned: ${reason}`;
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
console.log("wrote", fixturePath);
