// shared/protocol.js — wire message types + light validation.
// PURE (no node deps): lives in shared/ because it is a contract BOTH the server
// and the browser client use — neither should import from the other's directory
// (the static host only serves client/shared/engine/data, so a client import of
// server/* fails to load in the browser). See specs/19.
// Client -> server: JOIN, INPUT.  Server -> client: WELCOME, VIEW, ERROR.

export const C2S = { JOIN: "join", INPUT: "input", FORK: "forkChoice", RECLAIM: "reclaim" };
export const S2C = { HELLO: "hello", WELCOME: "welcome", VIEW: "view", ERROR: "error", RECLAIM_FAILED: "reclaim_failed" };

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
    // Optional difficulty (first joiner sets the race difficulty, specs/50/53).
    let diff = null;
    if (msg.diff != null) {
      if (!["easy", "medium", "hard"].includes(msg.diff)) return { ok: false, reason: "diff must be easy|medium|hard" };
      diff = msg.diff;
    }
    return { ok: true, msg: { type: C2S.JOIN, carId, diff } };
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
  if (msg.type === C2S.RECLAIM) {
    if (typeof msg.token !== "string" || msg.token.length === 0) return { ok: false, reason: "token required" };
    return { ok: true, msg: { type: C2S.RECLAIM, token: msg.token } };
  }
  return { ok: false, reason: `unknown type: ${msg.type}` };
}
