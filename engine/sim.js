// engine/sim.js — AI-only race runner + campaign helper (§15.4).
// Drives every seat with the deterministic ai_driver and returns an event
// census. The measurement instrument for "do systems fire?" and balance sweeps.

import { createInitialState } from "./state.js";
import { apply } from "./reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK } from "./commands.js";
import { hashSnapshot } from "./snapshot.js";
import { chooseInput } from "./ai_driver.js";

// Spread N cars across staggered start lanes (256 apart, symmetric about centre)
// so a field of AI drivers actually races instead of piling up on the centre line.
export function staggeredSeats(n, carId = 1) {
  const seats = [];
  for (let i = 0; i < n; i++) {
    seats.push({ id: i + 1, carId, laneX: Math.round((i - (n - 1) / 2) * 256) });
  }
  return seats;
}

export function runAiRace(ctx, opts = {}) {
  const rivalCollision = opts.rivalCollision ? 1 : 0;
  const runCtx = rivalCollision ? { ...ctx, rivalCollision: 1 } : ctx;
  const seats = opts.seats || staggeredSeats(opts.numSeats ?? 1);
  const maxTicks = opts.maxTicks ?? 6000;

  let state = createInitialState({
    seed: opts.seed ?? 12345,
    courseSet: ctx.courseSet, carSet: ctx.carSet,
    courseId: opts.courseId ?? 1,
    seats, startTimeTicks: opts.startTimeTicks ?? 1500,
    trafficConfig: ctx.trafficConfig,
    maxSeats: opts.maxSeats,
  });

  const census = { checkpoints: 0, collisions: 0, collisionsTraffic: 0, collisionsRival: 0, timeouts: 0, finishes: [] };
  const carOf = new Map(state.seats.map((s) => [s.id, s.carId]));
  let maxSpeed = 0;
  for (let t = 1; t <= maxTicks; t++) {
    for (const seat of state.seats) {
      if (seat.finishTicks >= 0 || seat.timedOut) continue;
      const inp = chooseInput(state, seat.id);
      state = apply(state, { type: CMD_INPUT, seatId: seat.id, ...inp }, runCtx);
    }
    state = apply(state, { type: CMD_ADVANCE_TICK }, runCtx);
    for (const seat of state.seats) if (seat.speed > maxSpeed) maxSpeed = seat.speed;
    for (const e of state.events) {
      if (e.type === "checkpoint") census.checkpoints++;
      else if (e.type === "collision") {
        census.collisions++;
        if (e.kind === "traffic") census.collisionsTraffic++;
        else if (e.kind === "rival") census.collisionsRival++;
      } else if (e.type === "timeout") census.timeouts++;
      else if (e.type === "finish") census.finishes.push({ seatId: e.seatId, tick: e.tick });
    }
    if (state.seats.every((s) => s.finishTicks >= 0 || s.timedOut)) break;
  }

  // Winner = the seat with the earliest finish tick. A same-tick dead heat is an
  // explicit TIE (winnerSeat -1, tie true) — NOT silently awarded to the lowest
  // seatId, which biased earlier seat-order fairness runs (§24).
  let winnerSeat = -1;
  let tie = false;
  if (census.finishes.length) {
    const minTick = Math.min(...census.finishes.map((f) => f.tick));
    const atMin = census.finishes.filter((f) => f.tick === minTick);
    if (atMin.length === 1) winnerSeat = atMin[0].seatId;
    else tie = true;
  }
  const avgFinishTicks = census.finishes.length
    ? Math.round(census.finishes.reduce((n, f) => n + f.tick, 0) / census.finishes.length)
    : -1;
  return {
    seed: opts.seed ?? 12345,
    census,
    winnerSeat,
    winnerCar: winnerSeat > 0 ? carOf.get(winnerSeat) : -1,
    tie,
    avgFinishTicks,
    maxSpeed,
    finalHash: hashSnapshot(state),
    lastTick: state.tick,
  };
}

// Run the same AI race across pinned seeds — the 5-seed "do systems fire?" gate.
export function runCampaign(ctx, opts = {}) {
  const seeds = opts.seeds || [1001, 1002, 1003, 1004, 1005];
  return seeds.map((seed) => runAiRace(ctx, { ...opts, seed }));
}
