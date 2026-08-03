--!strict
-- Luau twin of engine/collision.js — rival collision (tick order step 10).
-- Order-independent: deltas computed from pre-bump state, applied together.
-- Constants mirror shared/collision.js + car_physics MAX_LANE_OFFSET.

local fixed = require("./fixedmath")

local CAR_LENGTH = 512
local CAR_WIDTH = 200
local BUMP_SLOW = 200
local BUMP_PUSH = 64
local TRAFFIC_CRASH_DEN = 3
local CRASH_STUN_TICKS = 30
local MAX_LANE_OFFSET = 1024

local function overlapping(a, b): boolean
	return a.segmentId == b.segmentId
		and a.segmentId ~= -1
		and fixed.absI32(a.roadZ - b.roadZ) < CAR_LENGTH
		and fixed.absI32(a.laneX - b.laneX) < CAR_WIDTH
end

local function resolveTrafficCollisions(state, tick: number)
	local events = {}
	for _, seat in ipairs(state.seats) do
		if seat.active ~= 0 and seat.finishTicks < 0 and seat.timedOut == 0 and seat.crashedTicks == 0 then
			for _, t in ipairs(state.traffic) do
				if overlapping(seat, t) then
					seat.speed = 0 -- full stop on a crash (marker-0056); mirrors JS
					seat.crashedTicks = CRASH_STUN_TICKS
					table.insert(events, { type = "collision", kind = "traffic", seatId = seat.id, tick = tick })
					break
				end
			end
		end
	end
	return events
end

local function resolveRivalCollisions(state, tick: number)
	local seats = {}
	for _, s in ipairs(state.seats) do
		if s.active ~= 0 and s.finishTicks < 0 and s.timedOut == 0 then
			table.insert(seats, s)
		end
	end

	local dSpeed = {}
	local dLane = {}
	for _, s in ipairs(seats) do
		dSpeed[s.id] = 0
		dLane[s.id] = 0
	end

	local bumped = {}
	local seen = {}
	for i = 1, #seats do
		for j = i + 1, #seats do
			local a = seats[i]
			local b = seats[j]
			if overlapping(a, b) then
				dSpeed[a.id] -= BUMP_SLOW
				dSpeed[b.id] -= BUMP_SLOW
				local dir
				if a.laneX < b.laneX then
					dir = -1
				elseif a.laneX > b.laneX then
					dir = 1
				elseif a.id < b.id then
					dir = -1
				else
					dir = 1
				end
				dLane[a.id] += dir * BUMP_PUSH
				dLane[b.id] -= dir * BUMP_PUSH
				for _, id in ipairs({ a.id, b.id }) do
					if not seen[id] then
						seen[id] = true
						table.insert(bumped, id)
					end
				end
			end
		end
	end

	for _, s in ipairs(seats) do
		s.speed = fixed.clampI32(s.speed + dSpeed[s.id], 0, 2147483647)
		s.laneX = fixed.clampI32(s.laneX + dLane[s.id], -MAX_LANE_OFFSET, MAX_LANE_OFFSET)
	end

	local events = {}
	for _, id in ipairs(bumped) do
		table.insert(events, { type = "collision", kind = "rival", seatId = id, tick = tick })
	end
	return events
end

return {
	resolveRivalCollisions = resolveRivalCollisions,
	resolveTrafficCollisions = resolveTrafficCollisions,
	overlapping = overlapping,
}
