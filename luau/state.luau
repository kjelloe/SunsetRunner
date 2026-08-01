--!strict
-- Luau twin of engine/state.js — engine state shape + initial-state factory.

local prng = require("./prng")
local road = require("./road_data")
local trafficMod = require("./traffic")

local DEFAULT_START_TIME_TICKS = 1500

local function makeSeat(id: number, carId: number, startSegment: number, startTimeTicks: number)
	return {
		id = id,
		active = 1,
		connected = 1,
		carId = carId,
		segmentId = startSegment,
		roadZ = 0,
		laneX = 0,
		speed = 0,
		steerHeld = 0,
		accelHeld = 0,
		brakeHeld = 0,
		finishTicks = -1,
		timerTicks = startTimeTicks,
		timedOut = 0,
		forkChoice = 0,
	}
end

local function createInitialState(opts)
	local course = road.getCourse(opts.courseSet, opts.courseId)
	local startTimeTicks = opts.startTimeTicks or DEFAULT_START_TIME_TICKS
	local seats = {}
	for _, s in ipairs(opts.seats or {}) do
		table.insert(seats, makeSeat(s.id, s.carId, course.startSegment, startTimeTicks))
	end
	local state = {
		version = 1,
		tick = 0,
		seed = opts.seed % 4294967296,
		rng = prng.seedSfc32(opts.seed % 4294967296),
		race = {
			status = 1,
			courseId = opts.courseId,
			maxSeats = opts.maxSeats or #seats,
		},
		seats = seats,
		traffic = {},
		spawnedSegments = {},
		nextTrafficId = 1,
		events = {},
	}
	if opts.trafficConfig then
		trafficMod.spawnSegmentTraffic(state, opts.courseSet, opts.trafficConfig, course.startSegment)
	end
	return state
end

return {
	DEFAULT_START_TIME_TICKS = DEFAULT_START_TIME_TICKS,
	makeSeat = makeSeat,
	createInitialState = createInitialState,
}
