import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runCampaign } from "../engine/sim.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("the 5-seed AI campaign fires every system", () => {
  const results = runCampaign(ctx, { seeds: [1001, 1002, 1003, 1004, 1005], numSeats: 6, rivalCollision: 1 });
  assert.equal(results.length, 5);
  const totalFinishes = results.reduce((n, r) => n + r.census.finishes.length, 0);
  const totalCheckpoints = results.reduce((n, r) => n + r.census.checkpoints, 0);
  const totalCollisions = results.reduce((n, r) => n + r.census.collisions, 0);
  assert.ok(totalFinishes > 0, "finish fires");
  assert.ok(totalCheckpoints > 0, "checkpoint fires");
  assert.ok(totalCollisions > 0, "rival collision fires");
});

test("each seed is internally deterministic", () => {
  const a = runCampaign(ctx, { seeds: [1001], numSeats: 6, rivalCollision: 1 })[0];
  const b = runCampaign(ctx, { seeds: [1001], numSeats: 6, rivalCollision: 1 })[0];
  assert.equal(a.finalHash, b.finalHash);
});

// Documented finding (surfaced by the campaign, like Fireline's): the race seed
// is currently inert — traffic is seeded from segment.trafficSeed (constant) and
// the AI is deterministic, so all seeds produce the same race. Recorded here as a
// tripwire: if seed variation is later wired in (e.g. race-seeded traffic), this
// flips and the assertion below must be revisited.
test("KNOWN: race seed is inert (traffic is segment-seeded, not race-seeded)", () => {
  const s1 = runCampaign(ctx, { seeds: [1], numSeats: 6, rivalCollision: 1 })[0];
  const s2 = runCampaign(ctx, { seeds: [999999], numSeats: 6, rivalCollision: 1 })[0];
  assert.equal(s1.finalHash, s2.finalHash);
});
