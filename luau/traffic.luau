--!strict
-- Luau twin of engine/traffic.js — deterministic, segment-seeded traffic.
-- Roll order (roadZ, lane, kind) and the segment-only seeding must match JS
-- exactly or checkpoint_1a diverges. Lanes/kinds are 1-indexed here; JS index i
-- maps to Luau index i+1 (same element).

local prng = require("./prng")
local road = require("./road_data")
local fixed = require("./fixedmath")

local ROAD_UNIT = 256
-- Hazard constants mirror shared/collision.js.
local HAZARD_START = 384
local HAZARD_DESPAWN = 430
local HAZARD_SPEED = 26
local HAZARD_COUNT = 2
local HAZARD_SNOWMOBILE = 3
local HAZARD_SKIER = 4

local spawnSegmentHazards -- forward declaration (used by spawnSegmentTraffic)

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
	spawnSegmentHazards(state, seg, segLen)
	table.insert(state.spawnedSegments, segmentId)
end

-- Cross-hazards on snow terrain (scenerySet 10 snowmobile / 11 skier). Distinct
-- RNG stream so it never perturbs the traffic rolls above. Mirrors JS.
spawnSegmentHazards = function(state, seg, segLen: number)
	local kind = if seg.scenerySet == 10 then HAZARD_SNOWMOBILE elseif seg.scenerySet == 11 then HAZARD_SKIER else 0
	if kind == 0 then
		return
	end
	local rng = prng.seedSfc32((seg.trafficSeed * 2654435761 + state.seed + 777) % 4294967296)
	for _ = 1, HAZARD_COUNT do
		local r = prng.sfc32Next(rng)
		local roadZ = if segLen > 0 then r.value % segLen else 0
		rng = r.nextState
		r = prng.sfc32Next(rng)
		local dir = if r.value % 2 == 0 then 1 else -1
		rng = r.nextState
		table.insert(state.hazards, {
			id = state.nextHazardId,
			segmentId = seg.id,
			roadZ = roadZ,
			laneX = -dir * HAZARD_START,
			vx = dir * HAZARD_SPEED,
			kind = kind,
		})
		state.nextHazardId += 1
	end
end

local function advanceHazards(state)
	if #state.hazards == 0 then
		return
	end
	local kept = {}
	for _, h in ipairs(state.hazards) do
		h.laneX += h.vx
		if fixed.absI32(h.laneX) <= HAZARD_DESPAWN then
			table.insert(kept, h)
		end
	end
	state.hazards = kept
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

return { spawnSegmentTraffic = spawnSegmentTraffic, advanceTraffic = advanceTraffic, advanceHazards = advanceHazards }
