// client/session_remote.js — remote (server-authoritative) session with
// client-side prediction (§21.2). Same seam as session_local (setInput /
// getState). The server owns truth; we PREDICT the local car immediately and
// reconcile against each view. Import-safe; a WebSocket impl can be injected
// (opts.WebSocket) so this runs headless in tests. Prediction needs the course/
// car data, passed via opts.courseSet/carSet (main.js already loaded them);
// without them it falls back to rendering the raw view.

import { TICK_HZ } from "../shared/constants.js";
import { C2S, S2C } from "../shared/protocol.js";
import { createPredictor } from "./prediction.js";

export function createRemoteSession(url, opts = {}) {
  const WebSocketImpl = opts.WebSocket || (typeof WebSocket !== "undefined" ? WebSocket : null);
  const carId = opts.carId ?? 1;
  let ws = null;
  let seatId = null;
  let latest = null; // last received view
  let held = { steer: 0, accel: 0, brake: 0 };
  let sendTimer = null;
  let predictor = null;
  let seq = 0;
  let pendingFork = 0;

  function makePredictor(courseId) {
    if (!opts.courseSet || !opts.carSet) return null; // no data -> raw-view fallback
    return createPredictor(opts.courseSet, opts.carSet, {
      courseId, seatId, carId, startTimeTicks: opts.startTimeTicks,
    });
  }

  function connect() {
    if (!WebSocketImpl) throw new Error("no WebSocket implementation available");
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: C2S.JOIN, carId }));
      sendTimer = setInterval(() => {
        if (!ws || ws.readyState !== 1) return;
        seq += 1;
        ws.send(JSON.stringify({ type: C2S.INPUT, seq, ...held }));
        if (predictor) predictor.predict(seq, pendingFork); // predict the same tick locally
        pendingFork = 0;
      }, 1000 / TICK_HZ);
      sendTimer.unref?.();
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.type === S2C.WELCOME) {
        seatId = msg.seatId;
        predictor = makePredictor(msg.courseId ?? 1);
      } else if (msg.type === S2C.VIEW) {
        latest = msg;
        if (predictor && msg.self) predictor.reconcile(msg.self, msg.ackSeq ?? 0);
      }
    };
    return ws;
  }

  return {
    connect,
    get seatId() { return seatId; },
    setInput(input) { held = input; },
    setForkChoice(choice) {
      pendingFork = choice; // predicted on the next send
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: C2S.FORK, choice }));
    },
    // The local car is the PREDICTED self (instant); ghosts/traffic are the
    // authoritative view. Falls back to the raw view self if no predictor.
    getState() {
      if (!latest || !latest.self) return { tick: 0, seats: [], ghosts: [], traffic: [], events: [] };
      const self = predictor ? predictor.self() : latest.self;
      return {
        tick: latest.tick,
        seats: [self],
        ghosts: latest.ghosts,
        traffic: latest.traffic,
        events: latest.events,
      };
    },
    close() {
      if (sendTimer) clearInterval(sendTimer);
      if (ws) ws.close();
    },
  };
}
