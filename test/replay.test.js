import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createRoom } from "../server/game_room.js";
import { hashSnapshot } from "../engine/snapshot.js";
import { runReplay } from "../engine/replay.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

function playRoom() {
  const room = createRoom(ctx, { startTimeTicks: 1500, seed: 777, rivalCollision: 1 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.setInput(a, { steer: 0, accel: 1, brake: 0 });
  room.setInput(b, { steer: 1, accel: 1, brake: 0 });
  for (let i = 0; i < 40; i++) room.tick();
  room.setInput(a, { steer: -1, accel: 1, brake: 0 }); // mid-run change
  for (let i = 0; i < 40; i++) room.tick();
  return room;
}

test("a dumped replay reproduces the live game's final hash", () => {
  const room = playRoom();
  const liveHash = hashSnapshot(room.getState());
  const replay = room.dumpReplay();
  const r = runReplay(replay, ctx);
  assert.equal(r.lastTick, room.getState().tick);
  assert.equal(r.finalHash, liveHash);
});

test("replay carries the seeds/seats/inputs it needs to stand alone", () => {
  const replay = playRoom().dumpReplay();
  assert.equal(replay.meta.seed, 777);
  assert.equal(replay.scenario.rivalCollision, 1);
  assert.equal(replay.scenario.seats.length, 2);
  assert.ok(replay.scenario.inputs.length >= 3); // two initial + one change
  assert.equal(replay.scenario.runToMaxTicks, 1);
});

test("replaying twice is byte-identical", () => {
  const replay = playRoom().dumpReplay();
  assert.equal(runReplay(replay, ctx).finalHash, runReplay(replay, ctx).finalHash);
});
