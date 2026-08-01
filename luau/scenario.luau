--!strict
-- Luau twin of engine/scenario.js — deterministic scenario replay.

local stateMod = require("./state")
local reducer = require("./reducer")
local snapshot = require("./snapshot")

local function isCensus(t: string): boolean
	return t == "checkpoint" or t == "finish" or t == "timeout" or t == "collision"
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
		if not byTick[inp.tick] then
			byTick[inp.tick] = {}
		end
		table.insert(byTick[inp.tick], inp)
	end
	local forkByTick = {}
	for _, fc in ipairs(scenario.forkChoices or {}) do
		if not forkByTick[fc.tick] then
			forkByTick[fc.tick] = {}
		end
		table.insert(forkByTick[fc.tick], fc)
	end

	local seats = scenario.seats or { { id = 1, carId = scenario.carId } }
	local runCtx = ctx
	if scenario.rivalCollision then
		runCtx = {
			courseSet = ctx.courseSet,
			carSet = ctx.carSet,
			trafficConfig = ctx.trafficConfig,
			rivalCollision = 1,
		}
	end

	local state = stateMod.createInitialState({
		seed = scenario.seed,
		courseSet = ctx.courseSet,
		carSet = ctx.carSet,
		courseId = scenario.courseId,
		seats = seats,
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
		local fcs = forkByTick[t]
		if fcs then
			for _, fc in ipairs(fcs) do
				state = reducer.apply(state, { type = "forkChoice", seatId = fc.seatId or 1, choice = fc.choice }, runCtx)
			end
		end
		local inps = byTick[t]
		if inps then
			for _, inp in ipairs(inps) do
				state = reducer.apply(state, { type = "input", seatId = inp.seatId or 1, steer = inp.steer, accel = inp.accel, brake = inp.brake }, runCtx)
			end
		end
		state = reducer.apply(state, { type = "advance_tick" }, runCtx)
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
