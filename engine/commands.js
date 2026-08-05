// engine/commands.js — canonical command shapes + validation.
// Two commands this slice: an input frame (sets a seat's held controls) and
// advance_tick (steps the sim one tick). All payload values are integers.
// validate(cmd) -> { ok: true } | { ok: false, reason }.

export const CMD_INPUT = "input";
export const CMD_ADVANCE_TICK = "advance_tick";
export const CMD_FORK_CHOICE = "forkChoice";

import { STEER_UNIT } from "../shared/constants.js";

const BINARY = new Set([0, 1]);
const FORK_DIR = new Set([-1, 1]);

function isInt(v) {
  return Number.isInteger(v);
}
// steer is a signed magnitude in [-STEER_UNIT, STEER_UNIT] (analog; ±full = lock).
function isSteer(v) {
  return Number.isInteger(v) && v >= -STEER_UNIT && v <= STEER_UNIT;
}

export function validate(cmd) {
  if (!cmd || typeof cmd.type !== "string") return { ok: false, reason: "missing type" };
  switch (cmd.type) {
    case CMD_ADVANCE_TICK:
      return { ok: true };
    case CMD_INPUT: {
      if (!isInt(cmd.seatId)) return { ok: false, reason: "seatId must be int" };
      if (!isSteer(cmd.steer)) return { ok: false, reason: "steer out of range" };
      if (!BINARY.has(cmd.accel)) return { ok: false, reason: "accel must be 0|1" };
      if (!BINARY.has(cmd.brake)) return { ok: false, reason: "brake must be 0|1" };
      return { ok: true };
    }
    case CMD_FORK_CHOICE: {
      if (!isInt(cmd.seatId)) return { ok: false, reason: "seatId must be int" };
      if (!FORK_DIR.has(cmd.choice)) return { ok: false, reason: "choice must be -1|1" };
      return { ok: true };
    }
    default:
      return { ok: false, reason: `unknown command: ${cmd.type}` };
  }
}
