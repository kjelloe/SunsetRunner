import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runScenario } from "../engine/scenario.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
const fixture = read("./fixtures/checkpoint_1a.json");

test("checkpoint_1a: milestone replay matches every pinned hash", () => {
  const r = runScenario(fixture.scenario, ctx);
  for (const t of fixture.scenario.hashTicks) {
    assert.equal(r.hashes[t], fixture.expected.hashes[String(t)], `hash drift at tick ${t}`);
  }
  assert.equal(r.finalHash, fixture.expected.finalHash);
});

test("checkpoint_1a: event census is pinned (drift must be conscious)", () => {
  const r = runScenario(fixture.scenario, ctx);
  assert.deepEqual(r.census, fixture.expected.census);
  assert.equal(r.census.find((e) => e.type === "finish").tick, fixture.expected.finishTick);
});

test("checkpoint_1a: replay is byte-identical across two runs", () => {
  const a = runScenario(fixture.scenario, ctx);
  const b = runScenario(fixture.scenario, ctx);
  assert.equal(a.finalHash, b.finalHash);
  assert.deepEqual(a.census, b.census);
});

test("checkpoint_1a: the run actually finishes (loop terminates on completion)", () => {
  const r = runScenario(fixture.scenario, ctx);
  assert.equal(r.lastTick, fixture.expected.finishTick);
  assert.equal(r.state.seats[0].finishTicks, fixture.expected.finishTick);
});
