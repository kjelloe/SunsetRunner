// engine/fairness.js — fairness instruments (§16). Sweep-based measurements of
// structural bias: does start seat, or seat-iteration order, or car choice bias
// who wins — separate from the luck of a given traffic seed?

import { runAiRace, staggeredSeats } from "./sim.js";
import { runScenario } from "./scenario.js";
import { loadCourseSet, getCourse, getSegment } from "../shared/road_data.js";

function forkRun(ctx, courseId, choice, seed, startTimeTicks) {
  return runScenario({
    name: "swap", seed, courseId, startTimeTicks, maxTicks: 2000, hashTicks: [],
    seats: [{ id: 1, carId: 1 }],
    inputs: [{ tick: 1, seatId: 1, steer: 0, accel: 1, brake: 0 }],
    forkChoices: [{ tick: 1, seatId: 1, choice }],
  }, ctx);
}

// Mean (leftFinish - rightFinish) over seeds for a given course set (WITH traffic).
function branchDelta(ctx, courseId, seeds, startTimeTicks) {
  let sum = 0;
  let n = 0;
  for (const seed of seeds) {
    const l = forkRun(ctx, courseId, -1, seed, startTimeTicks).state.seats[0].finishTicks;
    const r = forkRun(ctx, courseId, 1, seed, startTimeTicks).state.seats[0].finishTicks;
    if (l > 0 && r > 0) { sum += l - r; n++; }
  }
  return n ? sum / n : 0;
}

// Seat-order fairness: two IDENTICAL cars at mirror-symmetric start lanes across
// many seeds. A fair sim gives each seat a comparable share of wins — a heavy
// skew would mean seat iteration order (or start-lane geometry) favours a seat.
export function seatOrderFairness(ctx, seeds) {
  const wins = new Map();
  let decisive = 0;
  let ties = 0;
  for (const seed of seeds) {
    const r = runAiRace(ctx, { seed, seats: staggeredSeats(2, 1), rivalCollision: 1 });
    if (r.tie) {
      ties++; // a same-tick dead heat favours no seat (§24)
    } else if (r.winnerSeat > 0) {
      wins.set(r.winnerSeat, (wins.get(r.winnerSeat) || 0) + 1);
      decisive++;
    }
  }
  return { decisive, ties, wins: Object.fromEntries(wins) };
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

// Traffic-swap fairness (§16.3): does traffic accidentally favour a fork branch?
// Measure the left-vs-right finish delta WITH traffic, then swap the two
// branches' trafficSeeds and measure again. On a geometrically fair course the
// whole delta is traffic-induced, so swapping the seeds swaps the advantage and
// the two deltas cancel (deltaNormal + deltaSwapped ≈ 0). A residual means a
// geometry/handling bias survives the swap.
export function trafficSwapFairness(roadsJson, carSet, trafficConfig, courseId, seeds, startTimeTicks = 3000) {
  const base = loadCourseSet(roadsJson);
  // Walk THIS course from its start to its fork (not just the first fork anywhere).
  let forkSeg = null;
  let segId = getCourse(base, courseId).startSegment;
  while (segId !== -1) {
    const s = getSegment(base, segId);
    if (s.forkLeft >= 0) { forkSeg = s; break; }
    segId = s.next;
  }
  if (!forkSeg) throw new Error(`course ${courseId} has no fork`);
  const A = forkSeg.forkLeft;
  const B = forkSeg.forkRight;

  const swappedJson = JSON.parse(JSON.stringify(roadsJson));
  const sa = swappedJson.segments.find((s) => s.id === A);
  const sb = swappedJson.segments.find((s) => s.id === B);
  [sa.trafficSeed, sb.trafficSeed] = [sb.trafficSeed, sa.trafficSeed];
  const swapped = loadCourseSet(swappedJson);

  const deltaNormal = branchDelta({ courseSet: base, carSet, trafficConfig }, courseId, seeds, startTimeTicks);
  const deltaSwapped = branchDelta({ courseSet: swapped, carSet, trafficConfig }, courseId, seeds, startTimeTicks);
  return {
    forkSegment: forkSeg.id,
    branches: [A, B],
    deltaNormal,
    deltaSwapped,
    residual: deltaNormal + deltaSwapped, // ~0 ⇒ all difference was traffic ⇒ geometry fair
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
