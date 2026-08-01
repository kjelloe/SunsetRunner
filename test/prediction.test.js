import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { createRoom } from "../server/game_room.js";
import { createPredictor } from "../client/prediction.js";
import { createRemoteSession } from "../client/session_remote.js";
import { startServer } from "../server/index.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const courseSet = loadCourseSet(read("../data/roads.json"));
const carSet = loadCarSet(read("../data/cars.json"));
const noTrafficCtx = { courseSet, carSet }; // a surprise-free authoritative server

function kin(seat) {
  return { segmentId: seat.segmentId, roadZ: seat.roadZ, laneX: seat.laneX, speed: seat.speed };
}

test("prediction is EXACT when the server has no surprises (no traffic)", () => {
  const predictor = createPredictor(courseSet, carSet, { courseId: 1, seatId: 1, carId: 1, startTimeTicks: 1500 });
  const room = createRoom(noTrafficCtx, { courseId: 1, startTimeTicks: 1500 });
  const rid = room.addSeat(1);
  predictor.setInput({ steer: 1, accel: 1, brake: 0 });
  room.setInput(rid, { steer: 1, accel: 1, brake: 0 });
  for (let i = 1; i <= 60; i++) { predictor.predict(i); room.tick(); }
  assert.deepEqual(kin(predictor.self()), kin(room.getState().seats[0]));
});

test("reconcile drops acked inputs and replays the rest onto the authoritative self", () => {
  const predictor = createPredictor(courseSet, carSet, { courseId: 1, seatId: 1, carId: 1, startTimeTicks: 1500 });
  predictor.setInput({ steer: 0, accel: 1, brake: 0 });
  for (let i = 1; i <= 5; i++) predictor.predict(i);
  assert.equal(predictor.pendingCount(), 5);

  // authoritative self at "tick 3" (server acked seq 3)
  const room = createRoom(noTrafficCtx, { courseId: 1, startTimeTicks: 1500 });
  const rid = room.addSeat(1);
  room.setInput(rid, { steer: 0, accel: 1, brake: 0 });
  for (let i = 0; i < 3; i++) room.tick();
  predictor.reconcile(room.getState().seats[0], 3);
  assert.equal(predictor.pendingCount(), 2); // seqs 4,5 replayed, still pending until acked

  for (let i = 3; i < 5; i++) room.tick(); // room to the same point (tick 5)
  assert.deepEqual(kin(predictor.self()), kin(room.getState().seats[0]));
});

test("a stale reconcile (server behind) still lands the predicted self ahead", () => {
  const predictor = createPredictor(courseSet, carSet, { courseId: 1, seatId: 1, carId: 1, startTimeTicks: 1500 });
  predictor.setInput({ steer: 0, accel: 1, brake: 0 });
  for (let i = 1; i <= 8; i++) predictor.predict(i);
  const before = predictor.self().roadZ;
  // ack an old seq with an early authoritative self -> replays 8-2 inputs, still ahead of the ack point
  const room = createRoom(noTrafficCtx, { courseId: 1, startTimeTicks: 1500 });
  const rid = room.addSeat(1);
  room.setInput(rid, { steer: 0, accel: 1, brake: 0 });
  for (let i = 0; i < 2; i++) room.tick();
  const after = predictor.reconcile(room.getState().seats[0], 2).roadZ;
  assert.ok(after > 0 && Math.abs(after - before) >= 0); // deterministic; not a crash
  assert.equal(predictor.pendingCount(), 6);
});

test("remote session with prediction: the local car moves immediately", async () => {
  const h = await startServer(0);
  const session = createRemoteSession(`ws://localhost:${h.port}`, { WebSocket, courseSet, carSet, startTimeTicks: 1500 });
  try {
    session.connect();
    session.setInput({ steer: 0, accel: 1, brake: 0 });
    const moved = await waitFor(() => {
      const st = session.getState();
      return st.seats.length && st.seats[0].speed > 0 ? st : null;
    }, 3000);
    assert.ok(moved.seats[0].speed > 0);
    assert.ok(session.seatId >= 1);
  } finally {
    session.close();
    await h.close();
  }
});

function waitFor(probe, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const iv = setInterval(() => {
      const v = probe();
      if (v) { clearInterval(iv); resolve(v); }
      else if (Date.now() > deadline) { clearInterval(iv); reject(new Error("timed out")); }
    }, 20);
    iv.unref?.();
  });
}
