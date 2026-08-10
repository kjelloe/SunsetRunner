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

// Steering input is now a signed MAGNITUDE in these units: ±STEER_UNIT = full
// lock (same authority as the old ±1), intermediate values = analog (mobile
// drag). Physics divides by STEER_UNIT, so full lock is byte-identical to before.
export const STEER_UNIT = 256;

// Difficulty scales checkpoint time bonuses as an integer percent
// (bonus * timeScale / 100). medium = 100 = identity, so the default and every
// golden (which sets no difficulty) are unaffected. Applied in the reducer.
export const DIFFICULTY = { easy: 130, medium: 100, hard: 75 };
export const DEFAULT_TIME_SCALE = 100;

// Boost pads (power-ups). Pads are COURSE DATA (segment.boostPads: [{roadZ,laneX}]),
// not engine state — like checkpoints/curves, they are read from ctx, so the only
// new hashed field is the seat's boostTicks countdown. Driving over a pad (within
// PAD_LENGTH along the road and PAD_WIDTH laterally) sets boostTicks = BOOST_TICKS;
// while it counts down the car gets BOOST_ACCEL extra shove and a BOOST_SPEED
// higher cap. Integer fixed-point, so JS and Luau agree exactly.
export const BOOST_TICKS = 40;    // 2 s of boost at 20 Hz
export const BOOST_ACCEL = 90;    // extra per-tick acceleration while boosting
export const BOOST_SPEED = 512;   // extra top-speed (2 speed units) while boosting
export const PAD_LENGTH = 512;    // roadZ pickup window (2 road units)
export const PAD_WIDTH = 256;     // lateral pickup half-width (one lane)

// State schema version — bump on any hashed-state shape change, then repin.
// v2: added cross-hazards (state.hazards + nextHazardId) — marker-0066.
// v3: added seat.boostTicks (boost-pad power-up) — marker-0097.
export const STATE_VERSION = 3;
