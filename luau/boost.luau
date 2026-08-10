--!strict
-- Luau twin of engine/boost.js — boost-pad pickup (tick order step 9c).
-- Pads are COURSE DATA (segment.boostPads: [{ roadZ, laneX }]), read from ctx,
-- so they add no engine state — only the seat's boostTicks countdown. Not
-- consumed (fixed road markers); re-crossing refreshes the boost.

local fixed = require("./fixedmath")
local road = require("./road_data")

local BOOST_TICKS = 40
local PAD_LENGTH = 512
local PAD_WIDTH = 256

local function resolveBoostPickups(state, courseSet)
	if not courseSet then
		return
	end
	for _, seat in ipairs(state.seats) do
		if seat.active == 0 or seat.finishTicks >= 0 or seat.timedOut ~= 0 then
			continue
		end
		local pads = road.getSegment(courseSet, seat.segmentId).boostPads
		if not pads then
			continue
		end
		for _, pad in ipairs(pads) do
			if fixed.absI32(seat.roadZ - pad.roadZ) < PAD_LENGTH and fixed.absI32(seat.laneX - pad.laneX) < PAD_WIDTH then
				seat.boostTicks = BOOST_TICKS
				break
			end
		end
	end
end

return { resolveBoostPickups = resolveBoostPickups }
