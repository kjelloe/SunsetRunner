--!strict
-- Luau twin of shared/prng.js — sfc32 via mix32, bit-identical.
-- NEVER math.random / Random.new — determinism is sacred.
-- Gate: test/fixtures/spine_golden.json (mix32, seedSfc32(12345), sfc32 first8).
-- EXPORTS (stable): mix32(v), seedSfc32(rootSeed), sfc32Next(state).

local U32 = 4294967296

-- (a * b) mod 2^32, exact in doubles. bit32 has no multiply.
local function mul32(a: number, b: number): number
	local aHi = math.floor(a / 65536) % 65536
	local aLo = a % 65536
	return (((aHi * b) % 65536) * 65536 + aLo * b) % U32
end

local function mix32(v: number): number
	v = v % U32
	v = bit32.bxor(v, bit32.rshift(v, 16))
	v = mul32(v, 0x45d9f3b)
	v = bit32.bxor(v, bit32.rshift(v, 16))
	v = mul32(v, 0x45d9f3b)
	v = bit32.bxor(v, bit32.rshift(v, 16))
	return v
end

export type Sfc32 = { a: number, b: number, c: number, d: number }

local function seedSfc32(rootSeed: number): Sfc32
	local s = rootSeed % U32
	return {
		a = mix32((s + 1) % U32),
		b = mix32((s + 2) % U32),
		c = mix32((s + 3) % U32),
		d = mix32((s + 4) % U32),
	}
end

local function sfc32Next(state: Sfc32): { value: number, nextState: Sfc32 }
	local t = (state.a + state.b + state.d) % U32
	local d = (state.d + 1) % U32
	local a = bit32.bxor(state.b, bit32.rshift(state.b, 9))
	local b = (state.c + bit32.lshift(state.c, 3)) % U32
	local c = (bit32.bor(bit32.lshift(state.c, 21), bit32.rshift(state.c, 11)) + t) % U32
	return { value = t, nextState = { a = a, b = b, c = c, d = d } }
end

return {
	mix32 = mix32,
	seedSfc32 = seedSfc32,
	sfc32Next = sfc32Next,
}
