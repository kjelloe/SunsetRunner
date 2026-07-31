// server/protocol.js — wire message types + light validation.
// Client -> server: JOIN, INPUT.  Server -> client: WELCOME, VIEW, ERROR.
// All input payload fields are integers (the same contract the reducer enforces).

export const C2S = { JOIN: "join", INPUT: "input" };
export const S2C = { WELCOME: "welcome", VIEW: "view", ERROR: "error" };

const TRISTATE = new Set([-1, 0, 1]);
const BINARY = new Set([0, 1]);

export function parseMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed json" };
  }
  if (!msg || typeof msg.type !== "string") return { ok: false, reason: "missing type" };
  if (msg.type === C2S.JOIN) {
    const carId = msg.carId ?? 1;
    if (!Number.isInteger(carId)) return { ok: false, reason: "carId must be int" };
    return { ok: true, msg: { type: C2S.JOIN, carId } };
  }
  if (msg.type === C2S.INPUT) {
    if (!TRISTATE.has(msg.steer)) return { ok: false, reason: "steer must be -1|0|1" };
    if (!BINARY.has(msg.accel)) return { ok: false, reason: "accel must be 0|1" };
    if (!BINARY.has(msg.brake)) return { ok: false, reason: "brake must be 0|1" };
    return { ok: true, msg: { type: C2S.INPUT, steer: msg.steer, accel: msg.accel, brake: msg.brake } };
  }
  return { ok: false, reason: `unknown type: ${msg.type}` };
}
