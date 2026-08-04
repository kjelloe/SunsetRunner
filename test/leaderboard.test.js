import { test } from "node:test";
import assert from "node:assert/strict";
import { rankResults, mergeResult } from "../shared/leaderboard.js";
import { recordScore, loadScores } from "../client/local_scores.js";

test("finishers rank by time; non-finishers by stage; finishers on top", () => {
  const r = rankResults([
    { name: "A", finishTicks: -1, stage: 5 },
    { name: "B", finishTicks: 300, stage: 30 },
    { name: "C", finishTicks: -1, stage: 12 },
    { name: "D", finishTicks: 250, stage: 30 },
  ]);
  assert.deepEqual(r.map((e) => e.name), ["D", "B", "C", "A"]); // D(250)<B(300); C(st12)>A(st5)
});

test("mergeResult keeps each name's best run and caps size", () => {
  let e = [];
  e = mergeResult(e, { name: "A", finishTicks: -1, stage: 4 });
  e = mergeResult(e, { name: "A", finishTicks: -1, stage: 9 }); // better stage
  e = mergeResult(e, { name: "A", finishTicks: -1, stage: 2 }); // worse -> ignored
  assert.equal(e.length, 1);
  assert.equal(e[0].stage, 9);
  e = mergeResult(e, { name: "A", finishTicks: 500, stage: 1 }); // finished -> better than any stage
  assert.equal(e[0].finishTicks, 500);
});

test("local_scores persists + ranks (fake store)", () => {
  let v = null;
  const store = { getItem: () => v, setItem: (_, x) => { v = x; } };
  const board = recordScore(store, { name: "Me", finishTicks: -1, stage: 6 });
  assert.equal(board[0].name, "Me");
  assert.equal(loadScores(store).length, 1);
});
