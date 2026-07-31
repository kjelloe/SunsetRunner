// shared/constants.js — pinned fixed-point conventions for the racer.
// Pick these once and never drift them: they define the meaning of every
// integer in engine state and every hash. Changing one repins every fixture.

export const ROAD_UNIT = 256;   // one block of forward road progress (roadZ)
export const LANE_WIDTH = 256;  // horizontal spacing between adjacent lanes (laneX)
export const SPEED_SCALE = 256; // internal speed unit; not km/h directly
export const TICK_HZ = 20;      // authoritative simulation rate

// Lane centre offsets (laneX), symmetric about road centre.
export const LEFT_LANE = -LANE_WIDTH;   // -256
export const CENTER_LANE = 0;
export const RIGHT_LANE = LANE_WIDTH;   // 256

// Fork choice encoding (matches the forkChoice command payload).
export const FORK_LEFT = -1;
export const FORK_RIGHT = 1;

// State schema version — bump on any hashed-state shape change, then repin.
export const STATE_VERSION = 1;
