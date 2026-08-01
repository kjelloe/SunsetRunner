// client/prediction.js — client-side prediction + server reconciliation (§21.2).
// Predicts ONLY the local car's kinematics (accel/brake/steer/curve/road) by
// running the real reducer on a single-seat, traffic-free local state — so input
// feels instant. The server stays authoritative: each view snaps the predicted
// self to the server's self and REPLAYS the inputs the server hasn't acked yet.
// Traffic/rival collisions are the server's to decide; a crash arrives as a
// correction on the next reconcile. Pure (no DOM); reuses engine/ verbatim.

import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK, CMD_FORK_CHOICE } from "../engine/commands.js";

const SELF_FIELDS = [
  "segmentId", "roadZ", "laneX", "speed", "steerHeld", "accelHeld", "brakeHeld",
  "finishTicks", "timerTicks", "timedOut", "forkChoice",
];

export function createPredictor(courseSet, carSet, opts) {
  const ctx = { courseSet, carSet }; // no trafficConfig / rivalCollision — server owns those
  let state = createInitialState({
    seed: 0, courseSet, carSet, courseId: opts.courseId,
    seats: [{ id: opts.seatId, carId: opts.carId }],
    startTimeTicks: opts.startTimeTicks,
  });
  const pending = []; // { seq, held, fork } inputs not yet acked by the server
  let held = { steer: 0, accel: 0, brake: 0 };

  function stepWith(inp) {
    if (inp.fork) state = apply(state, { type: CMD_FORK_CHOICE, seatId: opts.seatId, choice: inp.fork }, ctx);
    state = apply(state, { type: CMD_INPUT, seatId: opts.seatId, ...inp.held }, ctx);
    state = apply(state, { type: CMD_ADVANCE_TICK }, ctx);
  }

  return {
    setInput(input) { held = input; },

    // Predict one tick with the current held input, buffering it under `seq`.
    predict(seq, fork = 0) {
      const inp = { seq, held: { ...held }, fork };
      pending.push(inp);
      stepWith(inp);
      return this.self();
    },

    // Snap to the authoritative self, drop acked inputs, replay the rest.
    reconcile(serverSelf, ackSeq) {
      const seat = state.seats[0];
      for (const f of SELF_FIELDS) if (serverSelf[f] !== undefined) seat[f] = serverSelf[f];
      while (pending.length && pending[0].seq <= ackSeq) pending.shift();
      for (const inp of pending) stepWith(inp);
      return this.self();
    },

    self() {
      const s = state.seats[0];
      const out = { id: s.id, carId: s.carId, active: s.active, connected: s.connected };
      for (const f of SELF_FIELDS) out[f] = s[f];
      return out;
    },

    pendingCount() { return pending.length; },
  };
}
