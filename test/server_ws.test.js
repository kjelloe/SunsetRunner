import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startServer } from "../server/index.js";
import { C2S, S2C } from "../shared/protocol.js";

function nextMessage(ws, pred) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timed out waiting for message")), 3000);
    ws.on("message", function handler(raw) {
      const msg = JSON.parse(raw.toString());
      if (!pred || pred(msg)) {
        clearTimeout(to);
        ws.off("message", handler);
        resolve(msg);
      }
    });
  });
}

test("ws client joins, sends input, and receives a moving view", async () => {
  const h = await startServer(0);
  const ws = new WebSocket(`ws://localhost:${h.port}`);
  try {
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });

    ws.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const welcome = await nextMessage(ws, (m) => m.type === S2C.WELCOME);
    assert.equal(welcome.seatId, 1);

    ws.send(JSON.stringify({ type: C2S.INPUT, steer: 0, accel: 1, brake: 0 }));
    const view = await nextMessage(ws, (m) => m.type === S2C.VIEW && m.self && m.self.speed > 0);
    assert.ok(view.tick > 0);
    assert.ok(view.self.speed > 0);
    assert.equal(typeof view.hash, "string");
  } finally {
    ws.terminate();
    await h.close();
  }
});

test("malformed input is rejected without killing the connection", async () => {
  const h = await startServer(0);
  const ws = new WebSocket(`ws://localhost:${h.port}`);
  try {
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
    ws.send(JSON.stringify({ type: C2S.INPUT, steer: 5, accel: 1, brake: 0 }));
    const err = await nextMessage(ws, (m) => m.type === S2C.ERROR);
    assert.match(err.reason, /steer/);
  } finally {
    ws.terminate();
    await h.close();
  }
});

test("non-JSON garbage is rejected as malformed, connection survives", async () => {
  const h = await startServer(0);
  const ws = new WebSocket(`ws://localhost:${h.port}`);
  try {
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
    ws.send("}{ not json at all");
    const err = await nextMessage(ws, (m) => m.type === S2C.ERROR);
    assert.match(err.reason, /malformed/);
  } finally {
    ws.terminate();
    await h.close();
  }
});

test("oversized frame is dropped by maxPayload and the server keeps serving", async () => {
  const h = await startServer(0, { maxMessageBytes: 256 });
  const bad = new WebSocket(`ws://localhost:${h.port}`);
  try {
    await new Promise((r) => bad.on("open", r));
    const closed = new Promise((r) => bad.on("close", (code) => r(code)));
    bad.on("error", () => {}); // 1009 may surface as an error too
    bad.send(JSON.stringify({ type: C2S.JOIN, carId: 1, pad: "x".repeat(2048) }));
    const code = await closed;
    assert.equal(code, 1009); // message too big

    // Server is still healthy: a fresh client can join.
    const good = new WebSocket(`ws://localhost:${h.port}`);
    good.on("error", () => {});
    await new Promise((r) => good.on("open", r));
    good.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    const welcome = await nextMessage(good, (m) => m.type === S2C.WELCOME);
    assert.equal(welcome.seatId, 1);
    good.terminate();
  } finally {
    bad.terminate();
    await h.close();
  }
});

test("a message burst is rate-limited without crashing the room", async () => {
  const h = await startServer(0, { rate: { capacity: 5, refillPerSec: 0 } });
  const ws = new WebSocket(`ws://localhost:${h.port}`);
  try {
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
    ws.send(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
    await nextMessage(ws, (m) => m.type === S2C.WELCOME);
    // Flood: far more than the bucket allows. Most are dropped; server survives.
    for (let i = 0; i < 200; i++) ws.send(JSON.stringify({ type: C2S.INPUT, steer: 0, accel: 1, brake: 0 }));
    const view = await nextMessage(ws, (m) => m.type === S2C.VIEW);
    assert.ok(view.tick > 0); // room still ticking
  } finally {
    ws.terminate();
    await h.close();
  }
});
