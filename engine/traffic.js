// engine/traffic.js — deterministic, segment-seeded traffic (step 8).
// Traffic RNG is seeded ONLY from the segment's trafficSeed, so a segment always
// spawns the same traffic regardless of when/where the player reaches it and
// regardless of seat iteration order (gotcha #12/#15, §24). Integer only.
// Mutates the already-cloned state the reducer passes in.

import { ROAD_UNIT } from "../shared/constants.js";
import { seedSfc32, sfc32Next } from "../shared/prng.js";
import { getSegment } from "../shared/road_data.js";
import { HAZARD_START, HAZARD_DESPAWN, HAZARD_SPEED, HAZARD_COUNT, HAZARD_SNOWMOBILE, HAZARD_SKIER } from "../shared/collision.js";
import { absI32 } from "../shared/fixedmath.js";

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
  // Snow terrain also seeds crossing hazards (a distinct RNG stream so it never
  // perturbs the traffic rolls above — non-snow segments are byte-identical).
  spawnSegmentHazards(state, seg, segLen);
  state.spawnedSegments.push(segmentId);
}

// Cross-hazards on mountain (scenerySet 10 -> snowmobile) / alpine (11 -> skier).
// Each starts off one shoulder and slides across; hitting one is a crash.
export function spawnSegmentHazards(state, seg, segLen) {
  const kind = seg.scenerySet === 10 ? HAZARD_SNOWMOBILE : seg.scenerySet === 11 ? HAZARD_SKIER : 0;
  if (!kind) return;
  let rng = seedSfc32((Math.imul(seg.trafficSeed, 2654435761) + state.seed + 777) >>> 0);
  for (let i = 0; i < HAZARD_COUNT; i++) {
    let r = roll(rng, segLen); const roadZ = r.value; rng = r.rng;
    r = roll(rng, 2); const dir = r.value === 0 ? 1 : -1; rng = r.rng;
    state.hazards.push({
      id: state.nextHazardId,
      segmentId: seg.id,
      roadZ,
      laneX: -dir * HAZARD_START, // start off the shoulder it enters from
      vx: dir * HAZARD_SPEED,     // slides toward the far shoulder
      kind,
    });
    state.nextHazardId += 1;
  }
}

// Advance every hazard laterally; despawn once it crosses past the far shoulder.
export function advanceHazards(state) {
  if (state.hazards.length === 0) return;
  const kept = [];
  for (const h of state.hazards) {
    h.laneX += h.vx;
    if (absI32(h.laneX) <= HAZARD_DESPAWN) kept.push(h);
  }
  state.hazards = kept;
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
