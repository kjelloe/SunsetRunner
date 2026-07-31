--!strict
-- Luau twin of engine/scenario.js — deterministic scenario replay.

local stateMod = require("./state")
local reducer = require("./reducer")
local snapshot = require("./snapshot")

local function isCensus(t: string): boolean
	return t == "checkpoint" or t == "finish" or t == "timeout"
end

local function allDone(state): boolean
	for _, s in ipairs(state.seats) do
		if s.finishTicks < 0 and s.timedOut == 0 then
			return false
		end
	end
	return true
end

local function runScenario(scenario, ctx)
	local byTick = {}
	for _, inp in ipairs(scenario.inputs) do
		byTick[inp.tick] = inp
	end

	local state = stateMod.createInitialState({
		seed = scenario.seed,
		courseSet = ctx.courseSet,
		carSet = ctx.carSet,
		courseId = scenario.courseId,
		seats = { { id = 1, carId = scenario.carId } },
		startTimeTicks = scenario.startTimeTicks,
		trafficConfig = ctx.trafficConfig,
	})

	local hashTicks = {}
	for _, t in ipairs(scenario.hashTicks or {}) do
		hashTicks[t] = true
	end

	local hashes = {}
	local census = {}
	local lastTick = 0

	for t = 1, scenario.maxTicks do
		local inp = byTick[t]
		if inp then
			state = reducer.apply(state, { type = "input", seatId = 1, steer = inp.steer, accel = inp.accel, brake = inp.brake }, ctx)
		end
		state = reducer.apply(state, { type = "advance_tick" }, ctx)
		for _, e in ipairs(state.events) do
			if isCensus(e.type) then
				table.insert(census, { type = e.type, tick = e.tick })
			end
		end
		if hashTicks[t] then
			hashes[t] = snapshot.hashSnapshot(state)
		end
		lastTick = t
		if allDone(state) then
			break
		end
	end

	return { state = state, hashes = hashes, census = census, finalHash = snapshot.hashSnapshot(state), lastTick = lastTick }
end

return { runScenario = runScenario }
