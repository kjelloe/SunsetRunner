// engine/snapshot.js — canonical hash of full engine state.
// Separate from shared/statehash.js (the spine primitive): this serializes the
// growing engine state — race + seats — and is the module the Luau twin will
// mirror in the batched post-Milestone-1 port. Per-tick events are transient
// and deliberately NOT hashed. Every new hashed field is a conscious repin.

import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";

export function serializeSnapshot(state) {
  const w = createByteWriter();
  w.writeU32LE(state.version);
  w.writeU32LE(state.tick);

  w.writeU8(state.race.status);
  w.writeU32LE(state.race.courseId);
  w.writeU8(state.race.maxSeats);

  w.writeU16LE(state.seats.length);
  for (const s of state.seats) {
    w.writeU32LE(s.id);
    w.writeU8(s.active);
    w.writeU8(s.connected);
    w.writeU32LE(s.carId);
    w.writeI32LE(s.segmentId);
    w.writeI32LE(s.roadZ);
    w.writeI32LE(s.laneX);
    w.writeI32LE(s.speed);
    w.writeI32LE(s.steerHeld);
    w.writeU8(s.accelHeld);
    w.writeU8(s.brakeHeld);
    w.writeI32LE(s.finishTicks);
    w.writeI32LE(s.timerTicks);
    w.writeU8(s.timedOut);
    w.writeI32LE(s.forkChoice);
  }

  w.writeU32LE(state.nextTrafficId);
  w.writeU16LE(state.spawnedSegments.length);
  for (const id of state.spawnedSegments) w.writeI32LE(id);
  w.writeU16LE(state.traffic.length);
  for (const t of state.traffic) {
    w.writeU32LE(t.id);
    w.writeI32LE(t.segmentId);
    w.writeI32LE(t.roadZ);
    w.writeI32LE(t.laneX);
    w.writeI32LE(t.speed);
    w.writeU32LE(t.kind);
  }
  return w.toBytes();
}

export function hashSnapshot(state) {
  const { hashHi, hashLo } = computeFnv1a64(serializeSnapshot(state));
  return hashToHex64(hashHi, hashLo);
}
