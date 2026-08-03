--!strict
-- Cross-language parity gate: recompute every slice-002 golden vector in Luau
-- and assert it against test/fixtures/spine_golden.json (the same file the JS
-- tests pin). Run from repo root: `lune run luau/spine-check.luau`.
-- Exits non-zero on any mismatch so test/luau_twin.test.js can gate on it.

local fs = require("@lune/fs")
local serde = require("@lune/serde")
local process = require("@lune/process")

local prng = require("./prng")
local canonical = require("./canonical")
local statehash = require("./statehash")

local golden = serde.decode("json", fs.readFile("test/fixtures/spine_golden.json"))

local failures: { string } = {}
local function check(label: string, got: any, want: any)
	if got ~= want then
		table.insert(failures, string.format("%s: got %s, want %s", label, tostring(got), tostring(want)))
	end
end

-- mix32
check("mix32(0)", prng.mix32(0), golden.mix32["0"])
check("mix32(1)", prng.mix32(1), golden.mix32["1"])
check("mix32(12345)", prng.mix32(12345), golden.mix32["12345"])

-- seedSfc32(12345)
local seeded = prng.seedSfc32(12345)
local gs = golden.seedSfc32_12345
check("seedSfc32.a", seeded.a, gs.a)
check("seedSfc32.b", seeded.b, gs.b)
check("seedSfc32.c", seeded.c, gs.c)
check("seedSfc32.d", seeded.d, gs.d)

-- sfc32 first 8 from 12345
local st = prng.seedSfc32(12345)
for i = 1, 8 do
	local r = prng.sfc32Next(st)
	check("sfc32[" .. tostring(i) .. "]", r.value, golden.sfc32_first8_from_12345[i])
	st = r.nextState
end

-- FNV-1a 64
local he = canonical.computeFnv1a64({})
check("fnv1a64(empty)", canonical.hashToHex64(he.hashHi, he.hashLo), golden.fnv1a64.empty)
local hb = canonical.computeFnv1a64({ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 })
check("fnv1a64([1..10])", canonical.hashToHex64(hb.hashHi, hb.hashLo), golden.fnv1a64.bytes_1_to_10)

-- spine state hash
check("hashState(spine0)", statehash.hashState({
	version = 2, -- STATE_VERSION (bumped to 2 for cross-hazards, marker-0066)
	tick = 0,
	seed = 12345,
	rng = seeded,
}), golden.hashState_spine0)

if #failures > 0 then
	print("LUAU PARITY FAIL:")
	for _, f in ipairs(failures) do
		print("  " .. f)
	end
	process.exit(1)
end

print("LUAU PARITY OK — all spine golden vectors match")
