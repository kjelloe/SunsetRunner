// shared/protocol.js — wire message types + light validation.
// PURE (no node deps): lives in shared/ because it is a contract BOTH the server
// and the browser client use — neither should import from the other's directory
// (the static host only serves client/shared/engine/data, so a client import of
// server/* fails to load in the browser). See specs/19.
// Client -> server: JOIN, INPUT.  Server -> client: WELCOME, VIEW, ERROR.

export const C2S = { JOIN: "join", INPUT: "input", FORK: "forkChoice" };
export const S2C = { WELCOME: "welcome", VIEW: "view", ERROR: "error" };

const TRISTATE = new Set([-1, 0, 1]);
const BINARY = new Set([0, 1]);
const FORK_DIR = new Set([-1, 1]);

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
    const seq = Number.isInteger(msg.seq) ? msg.seq : 0; // optional input sequence (for prediction ack)
    return { ok: true, msg: { type: C2S.INPUT, steer: msg.steer, accel: msg.accel, brake: msg.brake, seq } };
  }
  if (msg.type === C2S.FORK) {
    if (!FORK_DIR.has(msg.choice)) return { ok: false, reason: "choice must be -1|1" };
    return { ok: true, msg: { type: C2S.FORK, choice: msg.choice } };
  }
  return { ok: false, reason: `unknown type: ${msg.type}` };
}
