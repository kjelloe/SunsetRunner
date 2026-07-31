import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";

const cfgJson = JSON.parse(readFileSync(new URL("../data/checkpoints.json", import.meta.url)));

test("data/checkpoints.json loads a positive startTimeTicks", () => {
  const cfg = loadCheckpointConfig(cfgJson);
  assert.equal(cfg.startTimeTicks, 1500);
});

test("rejects a non-positive or non-integer startTimeTicks", () => {
  assert.throws(() => loadCheckpointConfig({ startTimeTicks: 0 }), /startTimeTicks/);
  assert.throws(() => loadCheckpointConfig({ startTimeTicks: 12.5 }), /startTimeTicks/);
  assert.throws(() => loadCheckpointConfig({}), /startTimeTicks/);
});
