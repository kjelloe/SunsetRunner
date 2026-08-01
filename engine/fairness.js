// engine/fairness.js — fairness instruments (§16). Sweep-based measurements of
// structural bias: does start seat, or seat-iteration order, or car choice bias
// who wins — separate from the luck of a given traffic seed?

import { runAiRace, staggeredSeats } from "./sim.js";

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
