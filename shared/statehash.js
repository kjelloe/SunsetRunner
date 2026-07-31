// shared/statehash.js — canonical hash of engine state.
// Grows field-by-field as the reducer gains state. Every field written here
// becomes part of the deterministic contract, so additions require a repin.
// Spine scope: version + tick + seed + rng limbs. No car/road/traffic yet.

import { createByteWriter, computeFnv1a64, hashToHex64 } from "./canonical.js";

// Serialize the hashable subset of state to canonical bytes.
export function serializeState(state) {
  const w = createByteWriter();
  w.writeU32LE(state.version >>> 0);
  w.writeU32LE(state.tick >>> 0);
  w.writeU32LE(state.seed >>> 0);
  const rng = state.rng;
  w.writeU32LE(rng.a >>> 0);
  w.writeU32LE(rng.b >>> 0);
  w.writeU32LE(rng.c >>> 0);
  w.writeU32LE(rng.d >>> 0);
  return w.toBytes();
}

export function hashState(state) {
  const { hashHi, hashLo } = computeFnv1a64(serializeState(state));
  return hashToHex64(hashHi, hashLo);
}
