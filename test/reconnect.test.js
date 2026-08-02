import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { createRoom } from "../server/game_room.js";
import { createRemoteSession } from "../client/session_remote.js";
import { startServer } from "../server/index.js";
import { C2S, S2C } from "../shared/protocol.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

// --- room grace logic (deterministic, no network) ---
test("room: a disconnected seat survives grace, then the sweep frees it", () => {
  const room = createRoom(ctx, { graceTicks: 5, startTimeTicks: 1500 });
  const id = room.addSeat(1);
  const token = room.tokenFor(id);
  assert.ok(token);

  room.markDisconnected(id);
  for (let i = 0; i < 3; i++) room.tick();        // within grace
  assert.equal(room.reclaim(token), id);          // reclaimable, clears the clock
  assert.equal(room.seatCount, 1);

  room.markDisconnected(id);
  for (let i = 0; i < 8; i++) room.tick();         // past grace (5)
  assert.equal(room.reclaim(token), -1);           // swept
  assert.equal(room.seatCount, 0);
});

test("room: reclaim is idempotent for a live seat", () => {
  const room = createRoom(ctx, { graceTicks: 5 });
  const id = room.addSeat(1);
  const token = room.tokenFor(id);
  assert.equal(room.reclaim(token), id);
  assert.equal(room.reclaim(token), id); // no second seat, same id
  assert.equal(room.seatCount, 1);
});

// --- ws integration ---
function nextMsg(ws, pred) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timeout")), 3000);
    ws.on("message", function h(raw) {
      const m = JSON.parse(raw.toString());
      if (!pred || pred(m)) { clearTimeout(to); ws.off("message", h); resolve(m); }
    });
  });
}
const openWs = (url) => new Promise((r, j) => { const w = new WebSocket(url); w.on("open", () => r(w)); w.on("error", j); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("ws: drop the socket, reclaim within grace -> same seat", async () => {
  const h = await startServer(0, { graceTicks: 6 });
  const url = `ws://localhost:${h.port}`;
  try {
    const a = await openWs(url);
    a.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const w = await nextMsg(a, (m) => m.type === S2C.WELCOME);
    assert.equal(w.seatId, 1);
    a.terminate(); // abrupt 1006, the mobile-freeze analogue
    await sleep(80); // a couple ticks, well under grace (6*50ms)

    const b = await openWs(url);
    b.send(JSON.stringify({ type: C2S.RECLAIM, token: w.token }));
    const w2 = await nextMsg(b, (m) => m.type === S2C.WELCOME || m.type === S2C.RECLAIM_FAILED);
    assert.equal(w2.type, S2C.WELCOME);
    assert.equal(w2.seatId, w.seatId);
    b.terminate();
  } finally { await h.close(); }
});

test("ws: after grace expiry the seat is gone -> reclaim refused", async () => {
  const h = await startServer(0, { graceTicks: 2 });
  const url = `ws://localhost:${h.port}`;
  try {
    const a = await openWs(url);
    a.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const w = await nextMsg(a, (m) => m.type === S2C.WELCOME);
    a.terminate();
    await sleep(300); // > grace (2 ticks) + margin -> swept

    const b = await openWs(url);
    b.send(JSON.stringify({ type: C2S.RECLAIM, token: w.token }));
    const w2 = await nextMsg(b, (m) => m.type === S2C.RECLAIM_FAILED || m.type === S2C.WELCOME);
    assert.equal(w2.type, S2C.RECLAIM_FAILED);
    b.terminate();
  } finally { await h.close(); }
});

test("ws: reclaim supersedes an old socket still holding the seat", async () => {
  const h = await startServer(0, { graceTicks: 60 });
  const url = `ws://localhost:${h.port}`;
  try {
    const a = await openWs(url);
    a.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const w = await nextMsg(a, (m) => m.type === S2C.WELCOME);
    const aClosed = new Promise((r) => a.on("close", (code) => r(code)));

    const b = await openWs(url); // second tab, same person
    b.send(JSON.stringify({ type: C2S.RECLAIM, token: w.token }));
    const w2 = await nextMsg(b, (m) => m.type === S2C.WELCOME);
    assert.equal(w2.seatId, w.seatId);
    assert.equal(await aClosed, 4000); // old socket superseded
    b.terminate();
  } finally { await h.close(); }
});

test("session_remote: a persisted token reclaims the same seat on a new session", async () => {
  const h = await startServer(0, { graceTicks: 200 });
  const url = `ws://localhost:${h.port}`;
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  try {
    const a = createRemoteSession(url, { WebSocket, storage, courseSet: ctx.courseSet, carSet: ctx.carSet, startTimeTicks: 1500 });
    a.connect();
    await waitFor(() => a.seatId != null, 3000);
    const seatId = a.seatId;
    assert.ok(a.token && mem.get("sunset_runner_token") === a.token);
    a.close(); // socket closes -> server marks disconnected (grace running)

    const b = createRemoteSession(url, { WebSocket, storage, courseSet: ctx.courseSet, carSet: ctx.carSet, startTimeTicks: 1500 });
    b.connect(); // token in storage -> reclaims
    await waitFor(() => b.seatId != null, 3000);
    assert.equal(b.seatId, seatId);
    b.close();
  } finally { await h.close(); }
});

function waitFor(cond, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const iv = setInterval(() => {
      if (cond()) { clearInterval(iv); resolve(); }
      else if (Date.now() > deadline) { clearInterval(iv); reject(new Error("timed out")); }
    }, 20);
    iv.unref?.();
  });
}
