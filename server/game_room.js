// server/game_room.js — a single authoritative race room.
// Owns the engine state, applies queued per-seat input, advances one tick, and
// builds a per-seat view. Drop-in/out is handled at the room level (join/leave
// are server actions, not yet reducer commands); the sim itself stays the pure
// reducer. Ghost filtering is minimal here — refined in the ghost slice.

import { createInitialState, makeSeat } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK, CMD_FORK_CHOICE } from "../engine/commands.js";
import { hashSnapshot } from "../engine/snapshot.js";
import { getCourse } from "../shared/road_data.js";
import { inCollisionWindow } from "../shared/collision.js";
import { S2C } from "../shared/protocol.js";
import { TICK_HZ } from "../shared/constants.js";
import { randomUUID } from "node:crypto";

// Filtered rival state (§10): only what a client needs to render a ghost, plus
// collisionActive (1 when in the same segment/window as the viewer).
function ghostFor(self, s, name) {
  return {
    seatId: s.id, carId: s.carId, name: name || `P${s.id}`, segmentId: s.segmentId,
    roadZ: s.roadZ, laneX: s.laneX, speed: s.speed, finishTicks: s.finishTicks,
    collisionActive: inCollisionWindow(self, s) ? 1 : 0,
  };
}

// Race standings, deterministic and tie-broken by seatId (§24 seat-order/tie
// rules). Finished seats rank ahead by finish tick; the rest by progress proxy.
function computeStandings(seats) {
  const entries = seats.filter((s) => s.active).map((s) => ({
    seatId: s.id,
    finishTicks: s.finishTicks,
    finished: s.finishTicks >= 0,
    progress: s.segmentId * 1000000 + s.roadZ,
  }));
  entries.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && a.finishTicks !== b.finishTicks) return a.finishTicks - b.finishTicks;
    if (!a.finished && a.progress !== b.progress) return b.progress - a.progress;
    return a.seatId - b.seatId; // explicit deterministic tie-break
  });
  return entries.map((e, i) => ({ seatId: e.seatId, rank: i + 1, finishTicks: e.finishTicks }));
}

export function createRoom(ctx, opts = {}) {
  const courseId = opts.courseId ?? 1;
  const startTimeTicks = opts.startTimeTicks ?? 1500;
  const seed = opts.seed ?? 12345;
  const rivalCollision = opts.rivalCollision ? 1 : 0;
  const startSegment = getCourse(ctx.courseSet, courseId).startSegment;
  let state = createInitialState({
    seed,
    courseSet: ctx.courseSet, carSet: ctx.carSet, courseId,
    seats: [], startTimeTicks, trafficConfig: ctx.trafficConfig,
    maxSeats: opts.maxSeats ?? 8,
  });
  // Room ctx for the sim; rivalCollision is a per-room toggle (§10/§11).
  // timeScale (difficulty, specs/50) is mutable — the FIRST player to join sets
  // it; the reducer reads simCtx.timeScale each tick. Default medium (100).
  const simCtx = { ...ctx, rivalCollision, timeScale: opts.timeScale ?? 100 };
  let difficultyLocked = opts.timeScale != null;

  // Shared pre-race countdown (specs/53): while > 0 the room FREEZES (no sim
  // advance) so every seat starts together on GO. Begins when the first seat
  // joins an empty room. countdownTicks defaults to 0 (off) so unit/integration
  // tests are unaffected; the standalone server enables it (3 s).
  const countdownTicksTotal = opts.countdownTicks ?? 0;
  let countdownRemaining = 0;
  let raceStarted = false;
  const inputs = new Map(); // seatId -> latest { steer, accel, brake }
  const ackSeq = new Map(); // seatId -> latest input seq received (for client prediction)
  let nextSeatId = 1;

  // Replay recording (slice-013): seats + input CHANGES, dumped as a scenario.
  const seatsMeta = [];
  const recordedInputs = [];
  const recordedForks = [];
  const lastInputKey = new Map();

  // Presence (separate from the socket): a dropped connection marks the seat
  // disconnected, and a tick-based grace sweep frees it only after graceTicks.
  // Token identity survives reconnects. NOT part of the hashed engine state, so
  // no golden/determinism impact. See specs/33.
  const graceTicks = opts.graceTicks ?? 900; // 45 s at 20 Hz
  const presence = new Map(); // seatId -> { token, disconnectedTick|null }
  const names = new Map(); // seatId -> display name

  function freeSeat(seatId) {
    const seat = state.seats.find((s) => s.id === seatId);
    if (seat) seat.active = 0;
    inputs.delete(seatId);
    ackSeq.delete(seatId);
    presence.delete(seatId);
  }

  // Restore a serialized session (server-restart persistence, specs/35). Every
  // restored seat starts disconnected with a FRESH grace clock (no socket survives
  // a restart), so returning players reclaim within the window and the rest are
  // swept. Deterministic: the engine state is restored verbatim.
  function applyRestore(r) {
    state = r.state;
    nextSeatId = r.nextSeatId;
    if (r.timeScale != null) { simCtx.timeScale = r.timeScale; difficultyLocked = true; }
    raceStarted = true; // a restored race is already past its countdown
    presence.clear();
    for (const p of r.presence) presence.set(p.id, { token: p.token, disconnectedTick: state.tick });
    inputs.clear();
    for (const e of r.inputs) inputs.set(e.id, e.inp);
    ackSeq.clear();
    for (const [id, s] of r.ackSeq) ackSeq.set(id, s);
    names.clear();
    for (const [id, n] of r.names || []) names.set(id, n);
    seatsMeta.length = 0;
    for (const m of r.seatsMeta) seatsMeta.push({ ...m });
    recordedInputs.length = 0;
    for (const i of r.recordedInputs) recordedInputs.push({ ...i });
    recordedForks.length = 0;
    for (const f of r.recordedForks) recordedForks.push({ ...f });
  }
  if (opts.restore) applyRestore(opts.restore);

  return {
    get tick() { return state.tick; },
    get courseId() { return courseId; },
    get seatCount() { return state.seats.filter((s) => s.active).length; },

    get countdown() { return Math.ceil(countdownRemaining / TICK_HZ); }, // seconds
    get timeScale() { return simCtx.timeScale; },

    // A seat joins with a car and (first joiner only) the race difficulty as a
    // timeScale int. The first seat in an empty room starts the shared countdown.
    addSeat(carId = 1, timeScale, name) {
      if (this.seatCount >= state.race.maxSeats) return -1; // room full
      if (!raceStarted) {
        raceStarted = true;
        countdownRemaining = countdownTicksTotal;
        if (!difficultyLocked && timeScale != null) { simCtx.timeScale = timeScale; difficultyLocked = true; }
      }
      const id = nextSeatId++;
      state.seats.push(makeSeat(id, carId, startSegment, startTimeTicks));
      seatsMeta.push({ id, carId });
      names.set(id, name || `P${id}`);
      presence.set(id, { token: randomUUID(), disconnectedTick: null });
      return id;
    },

    nameFor(seatId) { return names.get(seatId) ?? `P${seatId}`; },

    tokenFor(seatId) { return presence.get(seatId)?.token ?? null; },

    // A dropped socket does NOT free the seat — the car keeps driving on its last
    // input while a grace clock runs (sweep() frees it after graceTicks).
    markDisconnected(seatId) {
      const p = presence.get(seatId);
      if (p) p.disconnectedTick = state.tick;
    },

    // Rebind a seat by token; idempotent (reclaiming a live seat just clears the
    // grace clock). Returns the seatId, or -1 if the seat is gone.
    reclaim(token) {
      for (const [seatId, p] of presence) {
        if (p.token === token) { p.disconnectedTick = null; return seatId; }
      }
      return -1;
    },

    removeSeat(seatId) { freeSeat(seatId); },

    setInput(seatId, input) {
      // Record only changes; the effect first lands on the next tick produced.
      const key = `${input.steer},${input.accel},${input.brake}`;
      if (lastInputKey.get(seatId) !== key) {
        recordedInputs.push({ tick: state.tick + 1, seatId, steer: input.steer, accel: input.accel, brake: input.brake });
        lastInputKey.set(seatId, key);
      }
      inputs.set(seatId, input);
      if (Number.isInteger(input.seq)) ackSeq.set(seatId, input.seq);
    },

    setForkChoice(seatId, choice) {
      state = apply(state, { type: CMD_FORK_CHOICE, seatId, choice }, simCtx);
      recordedForks.push({ tick: state.tick + 1, seatId, choice });
    },

    // Dump the game so far as a re-runnable scenario (slice-013).
    dumpReplay() {
      return {
        meta: { seed, courseId, startTimeTicks, rivalCollision, endedTick: state.tick },
        scenario: {
          name: "replay",
          seed, courseId, startTimeTicks, rivalCollision,
          maxTicks: state.tick,
          maxSeats: state.race.maxSeats,
          runToMaxTicks: 1, // reproduce the exact tick count, don't early-stop
          seats: seatsMeta.map((s) => ({ ...s })),
          hashTicks: [],
          inputs: recordedInputs.map((i) => ({ ...i })),
          forkChoices: recordedForks.map((f) => ({ ...f })),
        },
      };
    },

    // One authoritative sim step: drain queued inputs, then advance a tick.
    tick() {
      // Shared pre-race countdown: freeze the whole sim (clock + cars) until GO.
      if (countdownRemaining > 0) { countdownRemaining--; return state; }
      // Grace sweep: free seats whose disconnect grace has elapsed.
      for (const [seatId, p] of presence) {
        if (p.disconnectedTick !== null && state.tick - p.disconnectedTick > graceTicks) freeSeat(seatId);
      }
      for (const [seatId, inp] of inputs) {
        state = apply(state, { type: CMD_INPUT, seatId, steer: inp.steer, accel: inp.accel, brake: inp.brake }, simCtx);
      }
      state = apply(state, { type: CMD_ADVANCE_TICK }, simCtx);
      return state;
    },

    viewFor(seatId) {
      const self = state.seats.find((s) => s.id === seatId) || null;
      const ghosts = self
        ? state.seats.filter((s) => s.id !== seatId && s.active).map((s) => ghostFor(self, s, names.get(s.id)))
        : [];
      return {
        type: S2C.VIEW,
        tick: state.tick,
        countdown: Math.ceil(countdownRemaining / TICK_HZ), // seconds until GO (0 = racing)
        self,
        ackSeq: ackSeq.get(seatId) ?? 0, // last input seq the server has taken (prediction ack)
        ghosts,
        traffic: state.traffic,
        hazards: state.hazards,
        events: state.events,
        standings: computeStandings(state.seats),
        hash: hashSnapshot(state),
      };
    },

    getState() { return state; },

    // Snapshot the whole session for disk persistence (engine state + presence/
    // tokens + queued input + replay log). JSON-safe.
    serialize() {
      return {
        version: 1,
        state,
        nextSeatId,
        timeScale: simCtx.timeScale,
        presence: [...presence].map(([id, p]) => ({ id, token: p.token, disconnectedTick: p.disconnectedTick })),
        names: [...names],
        inputs: [...inputs].map(([id, inp]) => ({ id, inp })),
        ackSeq: [...ackSeq],
        seatsMeta: seatsMeta.map((m) => ({ ...m })),
        recordedInputs: recordedInputs.map((i) => ({ ...i })),
        recordedForks: recordedForks.map((f) => ({ ...f })),
      };
    },
  };
}
