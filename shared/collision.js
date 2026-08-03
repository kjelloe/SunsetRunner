// shared/collision.js — arcade collision geometry (pure, integer, Luau-portable).
// Two cars can only interact when on the SAME segment (same path branch); this
// keeps ghost/collision context independent of the pseudo-3D projection and of
// seat iteration order. Used by the server view (ghost highlight) and the engine
// collision step. See specs/11.

import { absI32 } from "./fixedmath.js";

export const CAR_LENGTH = 512; // roadZ proximity (2 road units) for a bump
export const CAR_WIDTH = 200;  // laneX proximity — narrower than a lane (256)

export const BUMP_SLOW = 200;  // speed shed by each car in a rival bump
export const BUMP_PUSH = 64;   // lateral shove applied to each car, apart

export const TRAFFIC_CRASH_DEN = 3;   // hitting traffic cuts speed to 1/3
export const CRASH_STUN_TICKS = 30;   // post-crash immunity so you don't re-crash every tick

// Cross-hazards (skiers/snowmobiles) that traverse the road laterally on snow
// terrain (scenerySet 10 mountain -> snowmobile kind 3, 11 alpine -> skier 4).
export const HAZARD_START = 384;      // lateral start offset (off one shoulder)
export const HAZARD_DESPAWN = 430;    // remove once it crosses past the far shoulder
export const HAZARD_SPEED = 26;       // lateral units per tick
export const HAZARD_COUNT = 2;        // hazards seeded per snow segment
export const HAZARD_SNOWMOBILE = 3;
export const HAZARD_SKIER = 4;

// Same segment and close enough along the road to be "near" (ghost highlight).
export function inCollisionWindow(a, b) {
  return a.segmentId === b.segmentId && a.segmentId !== -1
    && absI32(a.roadZ - b.roadZ) < CAR_LENGTH;
}

// Actually overlapping: near along the road AND overlapping laterally.
export function overlapping(a, b) {
  return inCollisionWindow(a, b) && absI32(a.laneX - b.laneX) < CAR_WIDTH;
}
