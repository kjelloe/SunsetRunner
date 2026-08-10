--!strict
-- Luau twin of shared/constants.js — pinned fixed-point conventions.
-- These define the meaning of every integer in engine state. Never drift them.

local LANE_WIDTH = 256

return {
	ROAD_UNIT = 256,
	LANE_WIDTH = LANE_WIDTH,
	SPEED_SCALE = 256,
	TICK_HZ = 20,
	LEFT_LANE = -LANE_WIDTH,
	CENTER_LANE = 0,
	RIGHT_LANE = LANE_WIDTH,
	FORK_LEFT = -1,
	FORK_RIGHT = 1,
	-- Boost pads (marker-0097): pads are course data; only seat.boostTicks is state.
	BOOST_TICKS = 40,
	BOOST_ACCEL = 90,
	BOOST_SPEED = 512,
	PAD_LENGTH = 512,
	PAD_WIDTH = 256,
	STATE_VERSION = 3,
}
