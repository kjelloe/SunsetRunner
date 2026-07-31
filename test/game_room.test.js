import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createRoom } from "../server/game_room.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("room seats drop-in players and advances the sim", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500, seed: 12345 });
  const seatId = room.addSeat(1);
  assert.equal(seatId, 1);
  room.setInput(seatId, { steer: 0, accel: 1, brake: 0 });
  for (let i = 0; i < 5; i++) room.tick();
  const view = room.viewFor(seatId);
  assert.equal(view.tick, 5);
  assert.ok(view.self.speed > 0);
  assert.ok(view.traffic.length > 0); // start-segment traffic spawned
});

test("viewFor separates self from ghosts", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.tick();
  const view = room.viewFor(a);
  assert.equal(view.self.seatId ?? view.self.id, a);
  assert.equal(view.ghosts.length, 1);
  assert.equal(view.ghosts[0].seatId, b);
});

test("room enforces maxSeats", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500, maxSeats: 2 });
  assert.equal(room.addSeat(1), 1);
  assert.equal(room.addSeat(1), 2);
  assert.equal(room.addSeat(1), -1); // full
});

test("leaving deactivates the seat and drops it from ghosts", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.removeSeat(b);
  room.tick();
  assert.equal(room.seatCount, 1);
  assert.equal(room.viewFor(a).ghosts.length, 0);
});

test("room replay is deterministic for identical inputs", () => {
  function run() {
    const room = createRoom(ctx, { startTimeTicks: 1500, seed: 999 });
    const id = room.addSeat(1);
    room.setInput(id, { steer: 1, accel: 1, brake: 0 });
    for (let i = 0; i < 30; i++) room.tick();
    return room.viewFor(id).hash;
  }
  assert.equal(run(), run());
});
