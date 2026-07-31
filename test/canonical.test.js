import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createByteWriter, computeFnv1a64, hashToHex64, assertU32, assertI32,
} from "../shared/canonical.js";
import { hashState } from "../shared/statehash.js";
import { seedSfc32 } from "../shared/prng.js";
import { STATE_VERSION } from "../shared/constants.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/spine_golden.json", import.meta.url)));

test("FNV-1a 64 offset basis is the empty-input hash", () => {
  const h = computeFnv1a64(new Uint8Array([]));
  assert.equal(hashToHex64(h.hashHi, h.hashLo), golden.fnv1a64.empty);
});

test("FNV-1a 64 pins for a known byte string", () => {
  const h = computeFnv1a64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  assert.equal(hashToHex64(h.hashHi, h.hashLo), golden.fnv1a64.bytes_1_to_10);
});

test("byte writer little-endian encoding", () => {
  const bytes = createByteWriter().writeU32LE(0x04030201).toBytes();
  assert.deepEqual([...bytes], [0x01, 0x02, 0x03, 0x04]);
});

test("writeI32LE encodes negatives two's-complement", () => {
  const bytes = createByteWriter().writeI32LE(-1).toBytes();
  assert.deepEqual([...bytes], [0xFF, 0xFF, 0xFF, 0xFF]);
});

test("assertU32 / assertI32 reject out-of-range", () => {
  assert.throws(() => assertU32(-1));
  assert.throws(() => assertI32(0x80000000));
});

test("hashState pins the spine state hash", () => {
  const state = { version: STATE_VERSION, tick: 0, seed: 12345, rng: seedSfc32(12345) };
  assert.equal(hashState(state), golden.hashState_spine0);
});
