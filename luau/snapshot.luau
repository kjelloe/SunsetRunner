--!strict
-- Luau twin of engine/snapshot.js — canonical hash of engine state.
-- Byte layout must match engine/snapshot.js field-for-field or checkpoint_1a
-- diverges. Per-tick events are not hashed.

local canonical = require("./canonical")

local function serializeSnapshot(state): { number }
	local w = canonical.createByteWriter()
	w.writeU32LE(state.version)
	w.writeU32LE(state.tick)

	w.writeU8(state.race.status)
	w.writeU32LE(state.race.courseId)
	w.writeU8(state.race.maxSeats)

	w.writeU16LE(#state.seats)
	for _, s in ipairs(state.seats) do
		w.writeU32LE(s.id)
		w.writeU8(s.active)
		w.writeU8(s.connected)
		w.writeU32LE(s.carId)
		w.writeI32LE(s.segmentId)
		w.writeI32LE(s.roadZ)
		w.writeI32LE(s.laneX)
		w.writeI32LE(s.speed)
		w.writeI32LE(s.steerHeld)
		w.writeU8(s.accelHeld)
		w.writeU8(s.brakeHeld)
		w.writeI32LE(s.finishTicks)
		w.writeI32LE(s.timerTicks)
		w.writeU8(s.timedOut)
		w.writeI32LE(s.forkChoice)
	end

	w.writeU32LE(state.nextTrafficId)
	w.writeU16LE(#state.spawnedSegments)
	for _, id in ipairs(state.spawnedSegments) do
		w.writeI32LE(id)
	end
	w.writeU16LE(#state.traffic)
	for _, t in ipairs(state.traffic) do
		w.writeU32LE(t.id)
		w.writeI32LE(t.segmentId)
		w.writeI32LE(t.roadZ)
		w.writeI32LE(t.laneX)
		w.writeI32LE(t.speed)
		w.writeU32LE(t.kind)
	end
	return w.toBytes()
end

local function hashSnapshot(state): string
	local h = canonical.computeFnv1a64(serializeSnapshot(state))
	return canonical.hashToHex64(h.hashHi, h.hashLo)
end

return { serializeSnapshot = serializeSnapshot, hashSnapshot = hashSnapshot }
