--!strict
-- Luau twin of engine/ai_driver.js — deterministic AI driver. chooseInput is a
-- command SOURCE (not part of the hashed reducer contract), but it is kept
-- byte-identical to JS so an AI race reproduces the JS AI golden (ai_1a gate) and
-- the Roblox host's opponents behave exactly like the browser's. Integer only.

local fixed = require("./fixedmath")

local LANE_WIDTH = 256
local STEER_UNIT = 256
local ROAD_HALF_WIDTH = 512

-- Difficulty tiers (mirror shared/constants.js / engine/ai_driver.js). `medium`
-- is the original behaviour, so the golden path (no skill) is unchanged.
local AI_SKILL = {
	easy = { lookahead = 3000, throttleOn = 3, throttlePeriod = 4 },
	medium = { lookahead = 6000, throttleOn = 1, throttlePeriod = 1 },
	hard = { lookahead = 9000, throttleOn = 1, throttlePeriod = 1 },
}
local DEFAULT_SKILL = AI_SKILL.medium

local function skillFor(level)
	return (level and AI_SKILL[level]) or DEFAULT_SKILL
end

local function chooseInput(state, seatId: number, skill)
	skill = skill or DEFAULT_SKILL
	local seat = nil
	for _, s in ipairs(state.seats) do
		if s.id == seatId then
			seat = s
			break
		end
	end
	if not seat or seat.finishTicks >= 0 or seat.timedOut ~= 0 then
		return { steer = 0, accel = 0, brake = 0 }
	end

	local threat = nil
	for _, t in ipairs(state.traffic) do
		if t.segmentId == seat.segmentId then
			local dz = t.roadZ - seat.roadZ
			if dz > 0 and dz <= skill.lookahead and fixed.absI32(t.laneX - seat.laneX) < LANE_WIDTH then
				if not threat or dz < threat.dz then
					threat = { dz = dz, laneX = t.laneX }
				end
			end
		end
	end

	local steer
	if threat then
		if threat.laneX > seat.laneX then
			steer = -1
		elseif threat.laneX < seat.laneX then
			steer = 1
		else
			steer = if seat.laneX > 0 then -1 else 1
		end
	elseif seat.laneX > ROAD_HALF_WIDTH then
		steer = -1
	elseif seat.laneX < -ROAD_HALF_WIDTH then
		steer = 1
	else
		steer = 0
	end
	local accel = if (state.tick % skill.throttlePeriod) < skill.throttleOn then 1 else 0
	return { steer = steer * STEER_UNIT, accel = accel, brake = 0 }
end

return { chooseInput = chooseInput, skillFor = skillFor, AI_SKILL = AI_SKILL, DEFAULT_SKILL = DEFAULT_SKILL }
