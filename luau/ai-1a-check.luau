--!strict
-- Cross-language AI gate: run the AI golden race (the same seed/course/seat as
-- JS runAiRace(seed=12345, numSeats=1)) through the Luau reducer + ai_driver twin
-- and assert byte-parity with the JS AI golden (tick 307, hash 43762b8616301876).
-- This proves the Luau AI opponents behave identically to the browser.
-- Run from repo root: `lune run luau/ai-1a-check.luau`.

local fs = require("@lune/fs")
local serde = require("@lune/serde")
local process = require("@lune/process")

local road = require("./road_data")
local car = require("./car_data")
local traffic = require("./traffic_data")
local stateMod = require("./state")
local reducer = require("./reducer")
local snapshot = require("./snapshot")
local ai = require("./ai_driver")

local function read(p)
	return serde.decode("json", fs.readFile(p))
end

local ctx = {
	courseSet = road.loadCourseSet(read("data/roads.json")),
	carSet = car.loadCarSet(read("data/cars.json")),
	trafficConfig = traffic.loadTrafficConfig(read("data/traffic.json")),
}

-- Mirror engine/sim.js runAiRace(ctx, { seed = 12345, numSeats = 1 }): one AI seat
-- (carId 1, lane centre), course 1, startTimeTicks 1500, medium skill (default).
local state = stateMod.createInitialState({
	seed = 12345,
	courseSet = ctx.courseSet,
	carSet = ctx.carSet,
	courseId = 1,
	seats = { { id = 1, carId = 1 } },
	startTimeTicks = 1500,
	trafficConfig = ctx.trafficConfig,
})

local lastTick = 0
for t = 1, 6000 do
	for _, seat in ipairs(state.seats) do
		if seat.finishTicks < 0 and seat.timedOut == 0 then
			local inp = ai.chooseInput(state, seat.id)
			state = reducer.apply(state, { type = "input", seatId = seat.id, steer = inp.steer, accel = inp.accel, brake = inp.brake }, ctx)
		end
	end
	state = reducer.apply(state, { type = "advance_tick" }, ctx)
	lastTick = t
	local allDone = true
	for _, s in ipairs(state.seats) do
		if s.finishTicks < 0 and s.timedOut == 0 then
			allDone = false
			break
		end
	end
	if allDone then
		break
	end
end

local finalHash = snapshot.hashSnapshot(state)
local EXPECT_HASH = "43762b8616301876"
local EXPECT_TICK = 307

if finalHash == EXPECT_HASH and lastTick == EXPECT_TICK then
	print("LUAU AI PARITY OK — ai_1a matches JS (" .. finalHash .. ")")
else
	print("LUAU AI PARITY FAIL: hash " .. finalHash .. " (want " .. EXPECT_HASH .. "), tick " .. lastTick .. " (want " .. EXPECT_TICK .. ")")
	process.exit(1)
end
