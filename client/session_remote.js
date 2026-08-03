// client/session_remote.js — remote session: prediction + drop-in/reconnect.
// Connection != presence (Pitfall model, specs/33): the socket drops constantly
// on mobile; the SERVER holds the seat for a grace window and the client reclaims
// it by token. So: persist the token, reconnect relentlessly (backoff +
// reconnect-on-visible), and reclaim on every open. The server owns truth; we
// predict the local car and reconcile each view. Import-safe (WebSocket / storage
// / document all injectable or guarded) so it runs headless in tests.

import { TICK_HZ } from "../shared/constants.js";
import { C2S, S2C } from "../shared/protocol.js";
import { createPredictor } from "./prediction.js";

const TOKEN_KEY = "sunset_runner_token";

export function createRemoteSession(url, opts = {}) {
  const WebSocketImpl = opts.WebSocket || (typeof WebSocket !== "undefined" ? WebSocket : null);
  const store = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const doc = opts.document || (typeof document !== "undefined" ? document : null);
  const carId = opts.carId ?? 1;
  const diff = opts.diff || null; // difficulty level (first joiner sets the race)

  let ws = null;
  let seatId = null;
  let token = readToken();
  let latest = null;
  let held = { steer: 0, accel: 0, brake: 0 };
  let pendingFork = 0;
  let predictor = null;
  let seq = 0;
  let sendTimer = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let closed = false;
  let status = "idle"; // idle | connecting | live | reconnecting | run_ended
  function setStatus(s) { if (s !== status) { status = s; opts.onStatus?.(s); } }

  function readToken() { try { return store?.getItem(TOKEN_KEY) || null; } catch { return null; } }
  function writeToken(t) { try { store?.setItem(TOKEN_KEY, t); } catch { /* quota — non-fatal */ } }
  function dropToken() { try { store?.removeItem(TOKEN_KEY); } catch { /* non-fatal */ } token = null; }

  function makePredictor(courseId) {
    if (!opts.courseSet || !opts.carSet) return null;
    return createPredictor(opts.courseSet, opts.carSet, { courseId, seatId, carId, startTimeTicks: opts.startTimeTicks });
  }

  function startSend() {
    if (sendTimer) return;
    sendTimer = setInterval(() => {
      if (!ws || ws.readyState !== 1) return;
      seq += 1;
      ws.send(JSON.stringify({ type: C2S.INPUT, seq, ...held }));
      if (predictor) predictor.predict(seq, pendingFork);
      pendingFork = 0;
    }, 1000 / TICK_HZ);
    sendTimer.unref?.();
  }
  function stopSend() { if (sendTimer) { clearInterval(sendTimer); sendTimer = null; } }

  function scheduleReconnect() {
    if (closed) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectTimer.unref?.();
    reconnectDelay = Math.min(reconnectDelay * 1.7, 5000);
  }

  function connect() {
    if (closed || !WebSocketImpl) return ws;
    if (status !== "reconnecting") setStatus("connecting");
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      // reclaim if we have a token, else a fresh join.
      if (token) ws.send(JSON.stringify({ type: C2S.RECLAIM, token }));
      else ws.send(JSON.stringify({ type: C2S.JOIN, carId, diff }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.type === S2C.WELCOME) {
        seatId = msg.seatId;
        if (msg.token) { token = msg.token; writeToken(token); }
        predictor = makePredictor(msg.courseId ?? 1);
        reconnectDelay = 1000;
        setStatus("live");
        startSend();
      } else if (msg.type === S2C.VIEW) {
        latest = msg;
        if (predictor && msg.self) predictor.reconcile(msg.self, msg.ackSeq ?? 0);
      } else if (msg.type === S2C.RECLAIM_FAILED) {
        // The run ended while we were away (grace expired). Don't strand: clear
        // the dead token, notify the UI, and drop back in as a fresh seat.
        dropToken();
        seatId = null;
        predictor = null;
        setStatus("run_ended");
        opts.onReclaimFailed?.();
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: C2S.JOIN, carId, diff }));
      }
    };
    ws.onclose = () => { stopSend(); if (!closed) setStatus("reconnecting"); scheduleReconnect(); };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    return ws;
  }

  if (doc) {
    doc.addEventListener("visibilitychange", () => {
      if (!closed && doc.visibilityState === "visible") {
        clearTimeout(reconnectTimer);
        if (!ws || ws.readyState > 1) connect(); // radio is back and the player is looking
      }
    });
  }

  return {
    connect,
    get seatId() { return seatId; },
    get token() { return token; },
    get status() { return status; },
    get countdown() { return latest?.countdown ?? 0; }, // seconds until GO (server-driven)
    setInput(input) { held = input; },
    setForkChoice(choice) {
      pendingFork = choice;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: C2S.FORK, choice }));
    },
    getState() {
      if (!latest || !latest.self) return { tick: 0, seats: [], ghosts: [], traffic: [], events: [] };
      const self = predictor ? predictor.self() : latest.self;
      return { tick: latest.tick, seats: [self], ghosts: latest.ghosts, traffic: latest.traffic, events: latest.events };
    },
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      stopSend();
      if (ws) ws.close();
    },
  };
}
