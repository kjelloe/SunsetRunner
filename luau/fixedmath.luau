--!strict
-- Luau twin of shared/fixedmath.js — 256-unit integer fixed-point.
-- Gate: test/fixtures (round-trips, symmetric truncDiv). Pure integer math.
-- EXPORTS (stable): CELL_SIZE, clampI32, floorDivI32, truncDivI32, absI32,
-- cellToWorld, worldToCellFloor, mulFixed, divFixed.

local CELL_SIZE = 256

local function clampI32(v: number, min: number, max: number): number
	if v < min then
		return min
	end
	if v > max then
		return max
	end
	return v
end

local function floorDivI32(a: number, b: number): number
	return math.floor(a / b)
end

-- Signed division rounded TOWARD ZERO — symmetric for +/- (mirrored routes).
local function truncDivI32(a: number, b: number): number
	local q = a / b
	if q < 0 then
		return math.ceil(q)
	end
	return math.floor(q)
end

local function absI32(v: number): number
	return if v < 0 then -v else v
end

local function cellToWorld(cell: number): number
	return cell * CELL_SIZE + math.floor(CELL_SIZE / 2)
end

local function worldToCellFloor(world: number): number
	return floorDivI32(world, CELL_SIZE)
end

local function mulFixed(a: number, b: number): number
	return floorDivI32(a * b, CELL_SIZE)
end

local function divFixed(a: number, b: number): number
	return floorDivI32(a * CELL_SIZE, b)
end

return {
	CELL_SIZE = CELL_SIZE,
	clampI32 = clampI32,
	floorDivI32 = floorDivI32,
	truncDivI32 = truncDivI32,
	absI32 = absI32,
	cellToWorld = cellToWorld,
	worldToCellFloor = worldToCellFloor,
	mulFixed = mulFixed,
	divFixed = divFixed,
}
