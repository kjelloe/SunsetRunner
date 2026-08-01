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
