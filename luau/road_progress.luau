--!strict
-- Luau twin of engine/road_progress.js — advance a seat along the road graph.

local road = require("./road_data")

local ROAD_UNIT = 256

local function segmentLength(courseSet, segmentId: number): number
	return road.getSegment(courseSet, segmentId).stripCount * ROAD_UNIT
end

local function isFork(seg): boolean
	return seg.forkLeft >= 0 or seg.forkRight >= 0
end

local function curveAt(courseSet, segmentId: number, roadZ: number): number
	if segmentId == -1 then
		return 0
	end
	local seg = road.getSegment(courseSet, segmentId)
	local m = #seg.curveProfile
	local stripIdx = math.min(math.floor(roadZ / ROAD_UNIT), seg.stripCount - 1)
	local idx = math.min(math.floor((stripIdx * m) / seg.stripCount), m - 1)
	return seg.curveProfile[idx + 1] -- 1-indexed
end

local function advanceRoad(seat, courseSet, tick: number)
	if seat.finishTicks >= 0 then
		return { finished = false, entered = {} }
	end
	seat.roadZ += seat.speed
	local segLen = segmentLength(courseSet, seat.segmentId)
	local entered = {}
	while seat.roadZ >= segLen do
		seat.roadZ -= segLen
		local cur = road.getSegment(courseSet, seat.segmentId)
		local nxt = road.nextSegment(courseSet, seat.segmentId, seat.forkChoice)
		if isFork(cur) then
			seat.forkChoice = 0
		end
		if nxt == -1 then
			seat.segmentId = -1
			seat.finishTicks = tick
			seat.roadZ = 0
			seat.speed = 0
			return { finished = true, entered = entered }
		end
		seat.segmentId = nxt
		table.insert(entered, nxt)
		segLen = segmentLength(courseSet, nxt)
	end
	return { finished = false, entered = entered }
end

return { advanceRoad = advanceRoad, curveAt = curveAt }
