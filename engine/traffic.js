// engine/traffic.js — deterministic, segment-seeded traffic (step 8).
// Traffic RNG is seeded ONLY from the segment's trafficSeed, so a segment always
// spawns the same traffic regardless of when/where the player reaches it and
// regardless of seat iteration order (gotcha #12/#15, §24). Integer only.
// Mutates the already-cloned state the reducer passes in.

import { ROAD_UNIT } from "../shared/constants.js";
import { seedSfc32, sfc32Next } from "../shared/prng.js";
import { getSegment } from "../shared/road_data.js";

function segmentLength(courseSet, segmentId) {
  return getSegment(courseSet, segmentId).stripCount * ROAD_UNIT;
}

// Non-negative modulo roll; both operands are unsigned so JS % is fine.
function roll(rng, max) {
  const r = sfc32Next(rng);
  return { value: max > 0 ? r.value % max : 0, rng: r.nextState };
}

// Spawn a segment's traffic exactly once. Roll order (roadZ, lane, kind) is
// fixed so the byte layout — and the hash — is stable.
export function spawnSegmentTraffic(state, courseSet, cfg, segmentId) {
  if (segmentId === -1 || state.spawnedSegments.includes(segmentId)) return;
  const segLen = segmentLength(courseSet, segmentId);
  const seg = getSegment(courseSet, segmentId);
  // Segment-seeded (stable per segment within a race) AND race-seeded (so
  // different race seeds produce different traffic — the basis for sweeps).
  let rng = seedSfc32((seg.trafficSeed + state.seed) >>> 0);
  for (let i = 0; i < cfg.density; i++) {
    let r = roll(rng, segLen); const roadZ = r.value; rng = r.rng;
    r = roll(rng, cfg.lanes.length); const laneX = cfg.lanes[r.value]; rng = r.rng;
    r = roll(rng, cfg.kinds.length); const kind = cfg.kinds[r.value]; rng = r.rng;
    state.traffic.push({
      id: state.nextTrafficId,
      segmentId,
      roadZ,
      laneX,
      speed: kind.speed,
      kind: kind.id,
    });
    state.nextTrafficId += 1;
  }
  state.spawnedSegments.push(segmentId);
}

// Advance every traffic car; despawn any that drove off the end of its segment.
// Order-preserving filter keeps the array (and hash) deterministic.
export function advanceTraffic(state, courseSet) {
  if (state.traffic.length === 0) return;
  const kept = [];
  for (const t of state.traffic) {
    t.roadZ += t.speed;
    if (t.roadZ < segmentLength(courseSet, t.segmentId)) kept.push(t);
  }
  state.traffic = kept;
}
