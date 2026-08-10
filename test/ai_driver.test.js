import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createInitialState, makeSeat } from "../engine/state.js";
import { chooseInput, AI_SKILL, skillFor, DEFAULT_SKILL } from "../engine/ai_driver.js";
import { runAiRace } from "../engine/sim.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("AI always accelerates and holds a clear lane", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  const inp = chooseInput(state, 1);
  assert.equal(inp.accel, 1);
  assert.equal(inp.brake, 0);
  assert.equal(inp.steer, 0); // centre, no traffic -> hold
});

test("AI dodges away from traffic ahead (symmetric)", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  state.seats[0] = Object.assign(makeSeat(1, 1, 1, 1500), { laneX: 0 });
  state.traffic = [{ id: 99, segmentId: 1, roadZ: 2000, laneX: 100, speed: 500, kind: 1 }];
  assert.equal(chooseInput(state, 1).steer, -256); // traffic to our right -> dodge left (full lock)
  state.traffic[0].laneX = -100;
  assert.equal(chooseInput(state, 1).steer, 256); // traffic to our left -> dodge right (mirror)
});

test("a finished seat gets a neutral input", () => {
  const state = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
  state.seats[0].finishTicks = 10;
  assert.deepEqual(chooseInput(state, 1), { steer: 0, accel: 0, brake: 0 });
});

test("AI-driven solo race finishes and is pinned (JS-only golden)", () => {
  const r = runAiRace(ctx, { seed: 12345, numSeats: 1 });
  // Full-stop traffic crashes (marker-0056) reshape the AI's line: it now takes
  // the left branch (1 checkpoint) and finishes at 307 (was 316/2cp under the
  // partial-slow crash of marker-0048).
  assert.equal(r.lastTick, 307);
  assert.equal(r.census.finishes.length, 1);
  assert.equal(r.census.checkpoints, 1);
  assert.equal(r.finalHash, "3ce72c5877d79295"); // more traffic (marker-0072)
  assert.equal(runAiRace(ctx, { seed: 12345, numSeats: 1 }).finalHash, r.finalHash); // deterministic
});

// --- AI difficulty tiers (marker-0096) — the default is medium, so the golden
// above (which passes no skill) is unchanged; only non-default tiers differ. ---

test("default skill is medium (the golden's behaviour is untouched)", () => {
  assert.equal(DEFAULT_SKILL, AI_SKILL.medium);
  assert.equal(skillFor(), AI_SKILL.medium);
  assert.equal(skillFor("nonsense"), AI_SKILL.medium);
  assert.equal(skillFor("hard"), AI_SKILL.hard);
});

test("easy AI coasts on a duty cycle; medium/hard hold the gas every tick", () => {
  const mk = (tick) => Object.assign(
    createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] }),
    { tick },
  );
  // easy = 3 on / 4: gas on ticks 0,1,2, off on tick 3.
  assert.equal(chooseInput(mk(0), 1, AI_SKILL.easy).accel, 1);
  assert.equal(chooseInput(mk(2), 1, AI_SKILL.easy).accel, 1);
  assert.equal(chooseInput(mk(3), 1, AI_SKILL.easy).accel, 0);
  // medium + hard never lift.
  for (const t of [0, 1, 2, 3, 7]) {
    assert.equal(chooseInput(mk(t), 1, AI_SKILL.medium).accel, 1);
    assert.equal(chooseInput(mk(t), 1, AI_SKILL.hard).accel, 1);
  }
});

test("hard AI's longer lookahead sees a threat that easy AI ignores", () => {
  const mk = () => {
    const s = createInitialState({ seed: 1, courseSet: ctx.courseSet, carSet: ctx.carSet, courseId: 1, seats: [{ id: 1, carId: 1 }] });
    s.seats[0] = Object.assign(makeSeat(1, 1, 1, 1500), { laneX: 0 });
    s.traffic = [{ id: 99, segmentId: 1, roadZ: 1500 + 4000, laneX: 100, speed: 500, kind: 1 }]; // 4000 ahead
    return s;
  };
  // 4000 ahead is inside hard/medium lookahead (9000/6000) but outside easy (3000).
  assert.equal(chooseInput(mk(), 1, AI_SKILL.hard).steer, -256);   // dodges early
  assert.equal(chooseInput(mk(), 1, AI_SKILL.medium).steer, -256);
  assert.equal(chooseInput(mk(), 1, AI_SKILL.easy).steer, 0);      // hasn't reacted yet
});
