--!strict
-- Luau twin of engine/road_progress.js — advance a seat along the road graph.

local road = require("./road_data")

local ROAD_UNIT = 256

local function segmentLength(courseSet, segmentId: number): number
	return road.getSegment(courseSet, segmentId).stripCount * ROAD_UNIT
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
		local nxt = road.nextSegment(courseSet, seat.segmentId, 0)
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

return { advanceRoad = advanceRoad }
