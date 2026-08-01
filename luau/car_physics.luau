--!strict
-- Luau twin of engine/car_physics.js — longitudinal + lateral motion.
-- Held flags are numbers here (0/1); compare ~= 0, since Luau treats 0 as truthy.

local fixed = require("./fixedmath")

local NATURAL_DRAG = 8
local ROAD_HALF_WIDTH = 512
local MAX_LANE_OFFSET = 1024
local CURVE_PUSH_DEN = 4096

local function stepLongitudinal(seat, car)
	local speed = seat.speed
	if seat.brakeHeld ~= 0 then
		speed -= car.brake
	elseif seat.accelHeld ~= 0 then
		speed += car.accel
	else
		speed -= NATURAL_DRAG
	end
	if seat.laneX < -ROAD_HALF_WIDTH or seat.laneX > ROAD_HALF_WIDTH then
		speed -= car.offroadDrag
	end
	seat.speed = fixed.clampI32(speed, 0, car.maxSpeed)
end

local function stepLateral(seat, car)
	local steerRate = car.steerLow - fixed.floorDivI32((car.steerLow - car.steerHigh) * seat.speed, car.maxSpeed)
	local laneX = seat.laneX + seat.steerHeld * steerRate
	seat.laneX = fixed.clampI32(laneX, -MAX_LANE_OFFSET, MAX_LANE_OFFSET)
end

local function applyCurvePush(seat, curve: number)
	local push = fixed.truncDivI32(curve * seat.speed, CURVE_PUSH_DEN)
	seat.laneX = fixed.clampI32(seat.laneX - push, -MAX_LANE_OFFSET, MAX_LANE_OFFSET)
end

return {
	NATURAL_DRAG = NATURAL_DRAG,
	ROAD_HALF_WIDTH = ROAD_HALF_WIDTH,
	MAX_LANE_OFFSET = MAX_LANE_OFFSET,
	stepLongitudinal = stepLongitudinal,
	stepLateral = stepLateral,
	applyCurvePush = applyCurvePush,
}
