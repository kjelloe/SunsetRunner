import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createRoom } from "../server/game_room.js";
import { inCollisionWindow, overlapping, CAR_LENGTH, CAR_WIDTH } from "../shared/collision.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("collision window: same segment + near along road", () => {
  const a = { segmentId: 1, roadZ: 1000, laneX: 0 };
  assert.ok(inCollisionWindow(a, { segmentId: 1, roadZ: 1000 + CAR_LENGTH - 1, laneX: 0 }));
  assert.ok(!inCollisionWindow(a, { segmentId: 1, roadZ: 1000 + CAR_LENGTH, laneX: 0 }));
  assert.ok(!inCollisionWindow(a, { segmentId: 2, roadZ: 1000, laneX: 0 }));
  assert.ok(!inCollisionWindow({ segmentId: -1, roadZ: 0 }, { segmentId: -1, roadZ: 0 }));
});

test("overlapping requires lateral proximity too", () => {
  const a = { segmentId: 1, roadZ: 1000, laneX: 0 };
  assert.ok(overlapping(a, { segmentId: 1, roadZ: 1000, laneX: CAR_WIDTH - 1 }));
  assert.ok(!overlapping(a, { segmentId: 1, roadZ: 1000, laneX: CAR_WIDTH }));
});

test("ghosts are filtered rival state with a collisionActive flag", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.tick(); // both at start segment, roadZ ~0 -> within window
  const view = room.viewFor(a);
  assert.equal(view.ghosts.length, 1);
  const g = view.ghosts[0];
  assert.equal(g.seatId, b);
  assert.deepEqual(Object.keys(g).sort(), ["carId", "collisionActive", "finishTicks", "laneX", "name", "roadZ", "seatId", "segmentId", "speed"]);
  assert.equal(g.collisionActive, 1); // co-located at the start line
});

test("standings rank finished ahead of racing, tie-broken by seatId", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.setInput(a, { steer: 0, accel: 1, brake: 0 }); // a drives, b idles
  for (let i = 0; i < 5; i++) room.tick();
  const standings = room.viewFor(a).standings;
  assert.equal(standings.length, 2);
  assert.equal(standings[0].seatId, a); // further along -> rank 1
  assert.equal(standings[0].rank, 1);
  assert.equal(standings[1].seatId, b);
});
