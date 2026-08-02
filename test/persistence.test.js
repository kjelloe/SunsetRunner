import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createRoom } from "../server/game_room.js";
import { hashSnapshot } from "../engine/snapshot.js";
import { saveSession, loadSession } from "../server/session_store.js";
import { startServer } from "../server/index.js";
import { C2S, S2C } from "../shared/protocol.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
let counter = 0;
const tmpFile = () => join(tmpdir(), `sunset_persist_${process.pid}_${counter++}.json`);

test("room serialize -> restore reproduces the exact engine state and tokens", () => {
  const room = createRoom(ctx, { startTimeTicks: 1500, seed: 5 });
  const a = room.addSeat(1);
  const b = room.addSeat(1);
  room.setInput(a, { steer: 0, accel: 1, brake: 0 });
  room.setInput(b, { steer: 1, accel: 1, brake: 0 });
  for (let i = 0; i < 25; i++) room.tick();
  const tokenA = room.tokenFor(a);

  const snap = JSON.parse(JSON.stringify(room.serialize())); // through-disk round-trip
  const restored = createRoom(ctx, { startTimeTicks: 1500, restore: snap });

  assert.equal(hashSnapshot(restored.getState()), hashSnapshot(room.getState()));
  assert.equal(restored.reclaim(tokenA), a); // token + seat survived
  // and it keeps ticking identically to the original
  for (let i = 0; i < 12; i++) { room.tick(); restored.tick(); }
  assert.equal(hashSnapshot(restored.getState()), hashSnapshot(room.getState()));
});

test("loadSession rejects a stale file and returns a fresh one", () => {
  const p = tmpFile();
  try {
    writeFileSync(p, JSON.stringify({ savedAt: Date.now() - 100000, room: { x: 1 } }));
    assert.equal(loadSession(p, 5000), null); // older than maxAge
    writeFileSync(p, JSON.stringify({ savedAt: Date.now(), room: { x: 1 } }));
    assert.deepEqual(loadSession(p, 5000), { x: 1 });
    assert.equal(loadSession(join(tmpdir(), "nope_does_not_exist.json"), 5000), null);
  } finally { try { unlinkSync(p); } catch { /* noop */ } }
});

test("saveSession + loadSession round-trip a room", () => {
  const p = tmpFile();
  try {
    const room = createRoom(ctx, { startTimeTicks: 1500 });
    room.addSeat(1);
    for (let i = 0; i < 5; i++) room.tick();
    assert.equal(saveSession(p, room), true);
    const restored = createRoom(ctx, { startTimeTicks: 1500, restore: loadSession(p, 60000) });
    assert.equal(hashSnapshot(restored.getState()), hashSnapshot(room.getState()));
  } finally { try { unlinkSync(p); } catch { /* noop */ } }
});

// The deploy path (Pitfall #4): join -> play -> kill the server -> boot a new one
// on the same state file -> reclaim resumes the same live run.
test("deploy handoff: restart on the same state file resumes the same seat", async () => {
  const statePath = tmpFile();
  try {
    const h1 = await startServer(0, { statePath, graceTicks: 200 });
    const ws = await openWs(`ws://localhost:${h1.port}`);
    ws.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const w = await nextMsg(ws, (m) => m.type === S2C.WELCOME);
    ws.send(JSON.stringify({ type: C2S.INPUT, seq: 1, steer: 0, accel: 1, brake: 0 }));
    await sleep(120); // advance the sim a few ticks
    const tickBefore = h1.room.tick;
    ws.terminate();
    await h1.close(); // deploy: save on shutdown

    const h2 = await startServer(0, { statePath, graceTicks: 200 });
    try {
      assert.ok(h2.room.tick >= tickBefore, "restored server resumed the live tick"); // continued, not reset
      const ws2 = await openWs(`ws://localhost:${h2.port}`);
      ws2.send(JSON.stringify({ type: C2S.RECLAIM, token: w.token }));
      const w2 = await nextMsg(ws2, (m) => m.type === S2C.WELCOME || m.type === S2C.RECLAIM_FAILED);
      assert.equal(w2.type, S2C.WELCOME);
      assert.equal(w2.seatId, w.seatId); // same seat across the restart
      ws2.terminate();
    } finally { await h2.close(); }
  } finally { try { unlinkSync(statePath); } catch { /* noop */ } }
});

const openWs = (url) => new Promise((r, j) => { const w = new WebSocket(url); w.on("open", () => r(w)); w.on("error", j); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function nextMsg(ws, pred) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timeout")), 3000);
    ws.on("message", function h(raw) {
      const m = JSON.parse(raw.toString());
      if (!pred || pred(m)) { clearTimeout(to); ws.off("message", h); resolve(m); }
    });
  });
}
