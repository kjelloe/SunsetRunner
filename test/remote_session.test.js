import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startServer } from "../server/index.js";
import { createRemoteSession } from "../client/session_remote.js";

// End-to-end seam test (headless): the client remote session, injected with the
// node `ws` implementation, drives a real server room and its getState() tracks
// the authoritative view.
test("remote session joins the server and tracks the authoritative view", async () => {
  const h = await startServer(0);
  const session = createRemoteSession(`ws://localhost:${h.port}`, { WebSocket });
  try {
    session.connect();
    session.setInput({ steer: 0, accel: 1, brake: 0 });

    // wait until the server has advanced us to a moving state
    const moved = await waitFor(() => {
      const s = session.getState();
      return s.seats.length > 0 && s.seats[0].speed > 0 ? s : null;
    }, 3000);

    assert.ok(moved.tick > 0);
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
