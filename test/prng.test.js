import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mix32, seedSfc32, sfc32Next } from "../shared/prng.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/spine_golden.json", import.meta.url)));

test("mix32 pins to golden vectors", () => {
  assert.equal(mix32(0) >>> 0, golden.mix32["0"]);
  assert.equal(mix32(1) >>> 0, golden.mix32["1"]);
  assert.equal(mix32(12345) >>> 0, golden.mix32["12345"]);
});

test("mix32 output is a u32", () => {
  const v = mix32(0xdeadbeef);
  assert.equal(v >>> 0, v);
});

test("seedSfc32 expands root seed deterministically", () => {
  assert.deepEqual(seedSfc32(12345), golden.seedSfc32_12345);
});

test("sfc32Next produces the pinned stream", () => {
  let st = seedSfc32(12345);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const r = sfc32Next(st);
    out.push(r.value >>> 0);
    st = r.nextState;
  }
  assert.deepEqual(out, golden.sfc32_first8_from_12345);
});

test("sfc32Next is pure — same state, same result", () => {
  const st = seedSfc32(7);
  const a = sfc32Next(st);
  const b = sfc32Next(st);
  assert.equal(a.value, b.value);
  assert.deepEqual(a.nextState, b.nextState);
});
