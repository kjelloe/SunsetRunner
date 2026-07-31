--!strict
-- Luau twin of shared/statehash.js — canonical hash of engine state.
-- Grows field-by-field with the reducer; every field is part of the contract.
-- Spine scope: version + tick + seed + rng limbs.
-- Gate: hashState(spine0) = 88ccfef8e9391fd8 (see spine_golden.json).
-- EXPORTS (stable): serializeState(state) -> {number}, hashState(state) -> hex.

local canonical = require("./canonical")

type Sfc32 = { a: number, b: number, c: number, d: number }
export type SpineState = { version: number, tick: number, seed: number, rng: Sfc32 }

local function serializeState(state: SpineState): { number }
	local w = canonical.createByteWriter()
	w.writeU32LE(state.version)
	w.writeU32LE(state.tick)
	w.writeU32LE(state.seed)
	w.writeU32LE(state.rng.a)
	w.writeU32LE(state.rng.b)
	w.writeU32LE(state.rng.c)
	w.writeU32LE(state.rng.d)
	return w.toBytes()
end

local function hashState(state: SpineState): string
	local h = canonical.computeFnv1a64(serializeState(state))
	return canonical.hashToHex64(h.hashHi, h.hashLo)
end

return {
	serializeState = serializeState,
	hashState = hashState,
}
