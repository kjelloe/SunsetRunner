--!strict
-- Luau twin of engine/traffic.js — deterministic, segment-seeded traffic.
-- Roll order (roadZ, lane, kind) and the segment-only seeding must match JS
-- exactly or checkpoint_1a diverges. Lanes/kinds are 1-indexed here; JS index i
-- maps to Luau index i+1 (same element).

local prng = require("./prng")
local road = require("./road_data")

local ROAD_UNIT = 256

local function contains(arr: { number }, v: number): boolean
	for _, x in ipairs(arr) do
		if x == v then
			return true
		end
	end
	return false
end

local function segmentLength(courseSet, segmentId: number): number
	return road.getSegment(courseSet, segmentId).stripCount * ROAD_UNIT
end

local function spawnSegmentTraffic(state, courseSet, cfg, segmentId: number)
	if segmentId == -1 or contains(state.spawnedSegments, segmentId) then
		return
	end
	local segLen = segmentLength(courseSet, segmentId)
	local seg = road.getSegment(courseSet, segmentId)
	-- segment-seeded AND race-seeded (mirrors engine/traffic.js).
	local rng = prng.seedSfc32((seg.trafficSeed + state.seed) % 4294967296)
	for _ = 1, cfg.density do
		local r = prng.sfc32Next(rng)
		local roadZ = if segLen > 0 then r.value % segLen else 0
		rng = r.nextState
		r = prng.sfc32Next(rng)
		local laneX = cfg.lanes[(r.value % #cfg.lanes) + 1]
		rng = r.nextState
		r = prng.sfc32Next(rng)
		local kind = cfg.kinds[(r.value % #cfg.kinds) + 1]
		rng = r.nextState
		table.insert(state.traffic, {
			id = state.nextTrafficId,
			segmentId = segmentId,
			roadZ = roadZ,
			laneX = laneX,
			speed = kind.speed,
			kind = kind.id,
		})
		state.nextTrafficId += 1
	end
	table.insert(state.spawnedSegments, segmentId)
end

local function advanceTraffic(state, courseSet)
	if #state.traffic == 0 then
		return
	end
	local kept = {}
	for _, t in ipairs(state.traffic) do
		t.roadZ += t.speed
		if t.roadZ < segmentLength(courseSet, t.segmentId) then
			table.insert(kept, t)
		end
	end
	state.traffic = kept
end

return { spawnSegmentTraffic = spawnSegmentTraffic, advanceTraffic = advanceTraffic }
