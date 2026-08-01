// engine/fairness.js — fairness instruments (§16). Sweep-based measurements of
// structural bias: does start seat, or seat-iteration order, or car choice bias
// who wins — separate from the luck of a given traffic seed?

import { runAiRace, staggeredSeats } from "./sim.js";
import { runScenario } from "./scenario.js";

// Seat-order fairness: two IDENTICAL cars at mirror-symmetric start lanes across
// many seeds. A fair sim gives each seat a comparable share of wins — a heavy
// skew would mean seat iteration order (or start-lane geometry) favours a seat.
export function seatOrderFairness(ctx, seeds) {
  const wins = new Map();
  let contested = 0;
  for (const seed of seeds) {
    const r = runAiRace(ctx, { seed, seats: staggeredSeats(2, 1), rivalCollision: 1 });
    if (r.winnerSeat > 0) {
      wins.set(r.winnerSeat, (wins.get(r.winnerSeat) || 0) + 1);
      contested++;
    }
  }
  return { contested, wins: Object.fromEntries(wins) };
}

// Route-mirror fairness (§16.1): on a course whose two branches are geometric
// MIRRORS, an accel-only car (no steering, no traffic) should finish each branch
// in the same time and drift the same magnitude — otherwise the physics has a
// left/right bias. Runs WITHOUT traffic so only geometry/handling is measured.
export function mirrorFairness(courseSetCtx, courseId, startTimeTicks = 3000) {
  const ctx = { courseSet: courseSetCtx.courseSet, carSet: courseSetCtx.carSet }; // no trafficConfig
  const run = (choice) => runScenario({
    name: "mirror", seed: 1, courseId, startTimeTicks, maxTicks: 2000,
    hashTicks: [], seats: [{ id: 1, carId: 1 }],
    inputs: [{ tick: 1, seatId: 1, steer: 0, accel: 1, brake: 0 }],
    forkChoices: [{ tick: 1, seatId: 1, choice }],
  }, ctx);
  const left = run(-1);
  const right = run(1);
  const leftFinish = left.state.seats[0].finishTicks;
  const rightFinish = right.state.seats[0].finishTicks;
  return {
    leftFinish,
    rightFinish,
    // mirror-fair when the two branches finish in the same time AND the final
    // lateral drift is equal-and-opposite.
    fair: leftFinish === rightFinish && left.state.seats[0].laneX === -right.state.seats[0].laneX,
    leftLaneX: left.state.seats[0].laneX,
    rightLaneX: right.state.seats[0].laneX,
  };
}

// Car-swap: field of car A vs field of car B over the same seeds — isolates car
// strength from route/seat luck (§16.2). Returns average finish tick per car
// (lower is stronger).
export function carSwap(ctx, seeds, carA, carB) {
  const avg = (carId) => {
    const ticks = [];
    for (const seed of seeds) {
      const r = runAiRace(ctx, { seed, seats: staggeredSeats(4, carId), rivalCollision: 1 });
      if (r.avgFinishTicks > 0) ticks.push(r.avgFinishTicks);
    }
    return ticks.length ? Math.round(ticks.reduce((n, x) => n + x, 0) / ticks.length) : -1;
  };
  return { carA, carB, avgFinishTicksA: avg(carA), avgFinishTicksB: avg(carB) };
}
