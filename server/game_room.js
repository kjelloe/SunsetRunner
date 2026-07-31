// server/game_room.js — a single authoritative race room.
// Owns the engine state, applies queued per-seat input, advances one tick, and
// builds a per-seat view. Drop-in/out is handled at the room level (join/leave
// are server actions, not yet reducer commands); the sim itself stays the pure
// reducer. Ghost filtering is minimal here — refined in the ghost slice.

import { createInitialState, makeSeat } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK } from "../engine/commands.js";
import { hashSnapshot } from "../engine/snapshot.js";
import { getCourse } from "../shared/road_data.js";
import { inCollisionWindow } from "../shared/collision.js";
import { S2C } from "./protocol.js";

// Filtered rival state (§10): only what a client needs to render a ghost, plus
// collisionActive (1 when in the same segment/window as the viewer).
function ghostFor(self, s) {
  return {
    seatId: s.id, carId: s.carId, segmentId: s.segmentId,
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
  const startSegment = getCourse(ctx.courseSet, courseId).startSegment;
  let state = createInitialState({
    seed: opts.seed ?? 12345,
    courseSet: ctx.courseSet, carSet: ctx.carSet, courseId,
    seats: [], startTimeTicks, trafficConfig: ctx.trafficConfig,
    maxSeats: opts.maxSeats ?? 8,
  });
  const inputs = new Map(); // seatId -> latest { steer, accel, brake }
  let nextSeatId = 1;

  return {
    get tick() { return state.tick; },
    get courseId() { return courseId; },
    get seatCount() { return state.seats.filter((s) => s.active).length; },

    addSeat(carId = 1) {
      if (this.seatCount >= state.race.maxSeats) return -1; // room full
      const id = nextSeatId++;
      state.seats.push(makeSeat(id, carId, startSegment, startTimeTicks));
      return id;
    },

    removeSeat(seatId) {
      const seat = state.seats.find((s) => s.id === seatId);
      if (seat) seat.active = 0;
      inputs.delete(seatId);
    },

    setInput(seatId, input) {
      inputs.set(seatId, input);
    },

    // One authoritative sim step: drain queued inputs, then advance a tick.
    tick() {
      for (const [seatId, inp] of inputs) {
        state = apply(state, { type: CMD_INPUT, seatId, steer: inp.steer, accel: inp.accel, brake: inp.brake }, ctx);
      }
      state = apply(state, { type: CMD_ADVANCE_TICK }, ctx);
      return state;
    },

    viewFor(seatId) {
      const self = state.seats.find((s) => s.id === seatId) || null;
      const ghosts = self
        ? state.seats.filter((s) => s.id !== seatId && s.active).map((s) => ghostFor(self, s))
        : [];
      return {
        type: S2C.VIEW,
        tick: state.tick,
        self,
        ghosts,
        traffic: state.traffic,
        events: state.events,
        standings: computeStandings(state.seats),
        hash: hashSnapshot(state),
      };
    },

    getState() { return state; },
  };
}
