--!strict
-- Luau twin of shared/canonical.js — canonical bytes + FNV-1a 64 hashing.
-- The JS hash was written limb-first specifically to port here without any
-- 64-bit integer type: four 16-bit limbs keep every multiply exact.
-- Gate: fnv1a64([]) = cbf29ce484222325, fnv1a64([1..10]) = 909856bd77277e52.
-- EXPORTS (stable): createByteWriter(), computeFnv1a64(data), hashToHex64(hi, lo).

local function createByteWriter()
	local bytes: { number } = {}
	local w
	w = {
		writeU8 = function(v: number)
			table.insert(bytes, v % 256)
			return w
		end,
		writeU16LE = function(v: number)
			table.insert(bytes, v % 256)
			table.insert(bytes, math.floor(v / 256) % 256)
			return w
		end,
		writeU32LE = function(v: number)
			table.insert(bytes, v % 256)
			table.insert(bytes, math.floor(v / 256) % 256)
			table.insert(bytes, math.floor(v / 65536) % 256)
			table.insert(bytes, math.floor(v / 16777216) % 256)
			return w
		end,
		toBytes = function()
			return bytes
		end,
	}
	return w
end

-- FNV-1a 64. offset = 0xcbf29ce484222325, prime = 0x100000001b3.
-- State is four 16-bit limbs (lo..hi); prime limbs p0=0x01b3, p2=0x0100.
local function computeFnv1a64(data: { number }): { hashHi: number, hashLo: number }
	local h0, h1, h2, h3 = 0x2325, 0x8422, 0x9ce4, 0xcbf2
	for i = 1, #data do
		h0 = bit32.bxor(h0, data[i])
		local p0 = 0x01b3
		local c0 = h0 * p0
		local c1 = h1 * p0
		local c2 = h2 * p0 + h0 * 0x0100
		local c3 = h3 * p0 + h1 * 0x0100
		h0 = c0 % 65536
		c1 = c1 + math.floor(c0 / 65536)
		h1 = c1 % 65536
		c2 = c2 + math.floor(c1 / 65536)
		h2 = c2 % 65536
		c3 = c3 + math.floor(c2 / 65536)
		h3 = c3 % 65536
	end
	return {
		hashHi = h3 * 65536 + h2,
		hashLo = h1 * 65536 + h0,
	}
end

local function hashToHex64(hashHi: number, hashLo: number): string
	return string.format("%08x%08x", hashHi, hashLo)
end

return {
	createByteWriter = createByteWriter,
	computeFnv1a64 = computeFnv1a64,
	hashToHex64 = hashToHex64,
}
