--!strict
-- Luau twin of engine/reducer.js — apply(state, command, ctx). Pure; pinned
-- tick order. Held flags are numbers (compare ~= 0). Luau `continue` matches
-- the JS early-continue.

local copyState = require("./copy_state")
local physics = require("./car_physics")
local roadProgress = require("./road_progress")
local trafficMod = require("./traffic")
local collision = require("./collision")
local car = require("./car_data")
local road = require("./road_data")

local function apply(state, command, ctx)
	local next = copyState.cloneState(state)

	if command.type == "input" then
		for _, seat in ipairs(next.seats) do
			if seat.id == command.seatId then
				if seat.active ~= 0 and seat.finishTicks < 0 then
					seat.steerHeld = command.steer
					seat.accelHeld = command.accel
					seat.brakeHeld = command.brake
				end
				break
			end
		end
		return next
	end

	if command.type == "forkChoice" then
		for _, seat in ipairs(next.seats) do
			if seat.id == command.seatId then
				if seat.active ~= 0 and seat.finishTicks < 0 then
					seat.forkChoice = command.choice
				end
				break
			end
		end
		return next
	end

	if command.type == "advance_tick" then
		next.events = {}
		next.tick = state.tick + 1
		for _, seat in ipairs(next.seats) do
			if seat.active == 0 or seat.finishTicks >= 0 or seat.timedOut ~= 0 then
				continue
			end
			local c = car.getCar(ctx.carSet, seat.carId)
			physics.stepLongitudinal(seat, c)
			physics.stepLateral(seat, c)
			physics.applyCurvePush(seat, roadProgress.curveAt(ctx.courseSet, seat.segmentId, seat.roadZ))
			local r = roadProgress.advanceRoad(seat, ctx.courseSet, next.tick)
			if r.finished then
				table.insert(next.events, { type = "finish", seatId = seat.id, tick = next.tick })
				continue
			end
			for _, segId in ipairs(r.entered) do
				local bonus = road.getSegment(ctx.courseSet, segId).checkpointTicks
				if bonus > 0 then
					seat.timerTicks += bonus
					table.insert(next.events, { type = "checkpoint", seatId = seat.id, segmentId = segId, bonus = bonus, tick = next.tick })
				end
				if ctx.trafficConfig then
					trafficMod.spawnSegmentTraffic(next, ctx.courseSet, ctx.trafficConfig, segId)
				end
			end
			seat.timerTicks -= 1
			if seat.timerTicks <= 0 then
				seat.timerTicks = 0
				seat.timedOut = 1
				seat.speed = 0
				table.insert(next.events, { type = "timeout", seatId = seat.id, tick = next.tick })
			end
		end
		for _, e in ipairs(collision.resolveTrafficCollisions(next, next.tick)) do
			table.insert(next.events, e)
		end
		if ctx.rivalCollision then
			for _, e in ipairs(collision.resolveRivalCollisions(next, next.tick)) do
				table.insert(next.events, e)
			end
		end
		trafficMod.advanceTraffic(next, ctx.courseSet)
		return next
	end

	return next
end

return { apply = apply }
