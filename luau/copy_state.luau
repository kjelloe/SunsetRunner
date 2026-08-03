--!strict
-- Luau twin of engine/copy_state.js — deep clone so the reducer stays pure.

local function copy(t)
	local o = {}
	for k, v in pairs(t) do
		o[k] = v
	end
	return o
end

local function copyArrayOfTables(a)
	local o = {}
	for i, v in ipairs(a) do
		o[i] = copy(v)
	end
	return o
end

local function copyArray(a)
	local o = {}
	for i, v in ipairs(a) do
		o[i] = v
	end
	return o
end

local function cloneState(state)
	return {
		version = state.version,
		tick = state.tick,
		seed = state.seed,
		rng = copy(state.rng),
		race = copy(state.race),
		seats = copyArrayOfTables(state.seats),
		traffic = copyArrayOfTables(state.traffic),
		hazards = copyArrayOfTables(state.hazards),
		spawnedSegments = copyArray(state.spawnedSegments),
		nextTrafficId = state.nextTrafficId,
		nextHazardId = state.nextHazardId,
		events = copyArrayOfTables(state.events),
	}
end

return { cloneState = cloneState }
