// client/session_remote.js — remote (server-authoritative) session.
// Same seam as session_local (setInput / getState) so main.js treats them
// alike; the difference is who advances the sim. Here the server owns truth:
// we send input at the tick rate and render the latest view. Import-safe.
// A WebSocket impl can be injected (opts.WebSocket) so this runs headless in
// tests; in the browser it uses the global WebSocket.

import { TICK_HZ } from "../shared/constants.js";
import { C2S, S2C } from "../server/protocol.js";

export function createRemoteSession(url, opts = {}) {
  const WebSocketImpl = opts.WebSocket || (typeof WebSocket !== "undefined" ? WebSocket : null);
  const carId = opts.carId ?? 1;
  let ws = null;
  let seatId = null;
  let latest = null; // last received view
  let held = { steer: 0, accel: 0, brake: 0 };
  let sendTimer = null;

  function connect() {
    if (!WebSocketImpl) throw new Error("no WebSocket implementation available");
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: C2S.JOIN, carId }));
      sendTimer = setInterval(() => {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: C2S.INPUT, ...held }));
      }, 1000 / TICK_HZ);
      sendTimer.unref?.();
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.type === S2C.WELCOME) seatId = msg.seatId;
      else if (msg.type === S2C.VIEW) latest = msg;
    };
    return ws;
  }

  return {
    connect,
    get seatId() { return seatId; },
    setInput(input) { held = input; },
    // Renderable state assembled from the latest view (self as seats[0]).
    getState() {
      if (!latest || !latest.self) return { tick: 0, seats: [], ghosts: [], traffic: [], events: [] };
      return {
        tick: latest.tick,
        seats: [latest.self],
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
