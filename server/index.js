// server/index.js — http static host + ws race room.
// No framework: node http serves the client/shared/engine/data files, `ws`
// carries the game protocol. The room advances at 20 Hz and broadcasts a
// per-seat view each tick. `startServer` is exported for tests; running the
// file directly boots on PORT (default 8000).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { WebSocketServer } from "ws";

import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { TICK_HZ } from "../shared/constants.js";
import { createRoom } from "./game_room.js";
import { saveSession, loadSession } from "./session_store.js";
import { createRateLimiter } from "./rate_limit.js";
import { C2S, S2C, parseMessage } from "../shared/protocol.js";

const DEFAULT_GRACE_TICKS = 900;
// Protocol messages are tiny (well under 1 KB); anything larger is junk/abuse.
const DEFAULT_MAX_MESSAGE_BYTES = 4096;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".map": "application/json",
};

// Serve static files under the repo root, only from the whitelisted top dirs.
const SERVE_DIRS = new Set(["client", "shared", "engine", "data"]);

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (urlPath === "/" || urlPath === "") urlPath = "/client/index.html";
  const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const top = rel.split(/[/\\]/)[0];
  if (!SERVE_DIRS.has(top)) { res.writeHead(404); res.end("not found"); return; }
  const filePath = resolve(repoRoot, rel);
  if (!filePath.startsWith(repoRoot)) { res.writeHead(403); res.end("forbidden"); return; }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}

async function loadCtx() {
  const read = async (p) => JSON.parse(await readFile(resolve(repoRoot, p)));
  return {
    courseSet: loadCourseSet(await read("data/roads.json")),
    carSet: loadCarSet(await read("data/cars.json")),
    trafficConfig: loadTrafficConfig(await read("data/traffic.json")),
    startTimeTicks: loadCheckpointConfig(await read("data/checkpoints.json")).startTimeTicks,
  };
}

export async function startServer(port = 8000, roomOpts = {}) {
  const ctx = await loadCtx();
  // Persistence is opt-in via statePath (the entrypoint sets it; tests pass a temp
  // file or omit it). On boot, restore a session younger than the grace window.
  const statePath = roomOpts.statePath || null;
  const graceTicks = roomOpts.graceTicks ?? DEFAULT_GRACE_TICKS;
  const restore = statePath ? loadSession(statePath, (graceTicks / TICK_HZ) * 1000) : null;
  const room = createRoom(ctx, { startTimeTicks: ctx.startTimeTicks, graceTicks, ...roomOpts, restore });

  const maxMessageBytes = roomOpts.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  const server = createServer(serveStatic);
  // maxPayload caps frame size at the ws layer (oversized frame -> 1009 close),
  // so a giant-frame flood can't allocate unbounded memory.
  const wss = new WebSocketServer({ server, maxPayload: maxMessageBytes });
  const clients = new Map(); // ws -> seatId

  // Close any socket currently bound to a seat (reclaim supersede: same player,
  // new tab/device wins) — code 4000.
  function supersede(seatId, keepWs) {
    for (const [otherWs, sid] of clients) {
      if (sid === seatId && otherWs !== keepWs) {
        clients.delete(otherWs);
        try { otherWs.close(4000, "superseded"); } catch { /* already gone */ }
      }
    }
  }

  function sendWelcome(ws, seatId) {
    ws.send(JSON.stringify({
      type: S2C.WELCOME, seatId, token: room.tokenFor(seatId),
      courseId: room.courseId, tick: room.tick,
    }));
  }

  wss.on("connection", (ws) => {
    // A connected-but-not-joined client is a spectator with context (§ drop-in).
    ws.send(JSON.stringify({ type: S2C.HELLO, courseId: room.courseId, tick: room.tick, seatCount: room.seatCount }));

    // Per-connection flood control. A well-behaved client sends ~20 msg/s.
    const limiter = createRateLimiter(roomOpts.rate);
    // Guard the socket-level 'error' (e.g. a 1009 oversized-frame close) so a
    // bad client can't take the process down with an uncaught exception.
    ws.on("error", () => { try { ws.terminate(); } catch { /* already gone */ } });

    ws.on("message", (raw) => {
      const text = raw.toString();
      // Belt-and-suspenders alongside maxPayload; also drops oversized text.
      if (text.length > maxMessageBytes) {
        ws.send(JSON.stringify({ type: S2C.ERROR, reason: "message too large" }));
        return;
      }
      if (!limiter.allow()) return; // over rate: drop silently, no feedback loop
      const parsed = parseMessage(text);
      if (!parsed.ok) { ws.send(JSON.stringify({ type: S2C.ERROR, reason: parsed.reason })); return; }
      const msg = parsed.msg;
      if (msg.type === C2S.JOIN) {
        const seatId = room.addSeat(msg.carId);
        if (seatId === -1) { ws.send(JSON.stringify({ type: S2C.ERROR, reason: "room full" })); return; }
        clients.set(ws, seatId);
        sendWelcome(ws, seatId);
      } else if (msg.type === C2S.RECLAIM) {
        const seatId = room.reclaim(msg.token);
        if (seatId === -1) { ws.send(JSON.stringify({ type: S2C.RECLAIM_FAILED })); return; }
        supersede(seatId, ws); // old tab/zombie loses the seat
        clients.set(ws, seatId);
        sendWelcome(ws, seatId);
      } else if (msg.type === C2S.INPUT) {
        const seatId = clients.get(ws);
        if (seatId != null) room.setInput(seatId, msg);
      } else if (msg.type === C2S.FORK) {
        const seatId = clients.get(ws);
        if (seatId != null) room.setForkChoice(seatId, msg.choice);
      }
    });

    ws.on("close", () => {
      const seatId = clients.get(ws);
      // Presence != connection: mark disconnected (grace window), don't free.
      if (seatId != null && clients.get(ws) === seatId) room.markDisconnected(seatId);
      clients.delete(ws);
    });
  });

  const interval = setInterval(() => {
    room.tick();
    for (const [ws, seatId] of clients) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(room.viewFor(seatId)));
    }
  }, 1000 / TICK_HZ);
  interval.unref?.();

  // Autosave every 5 s (a hard crash loses at most that). Deploys save on close().
  const saveTimer = statePath ? setInterval(() => saveSession(statePath, room), 5000) : null;
  saveTimer?.unref?.();

  await new Promise((r) => server.listen(port, r));
  return {
    room,
    port: server.address().port,
    async close() {
      clearInterval(interval);
      if (saveTimer) clearInterval(saveTimer);
      if (statePath) saveSession(statePath, room); // lossless handoff on shutdown
      for (const ws of clients.keys()) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  const statePath = process.env.STATE_FILE || resolve(repoRoot, ".state/session.json");
  startServer(port, { statePath }).then((h) => {
    console.log(`Sunset Runner server on http://localhost:${h.port}/client/index.html`);
    // SIGTERM/SIGINT (deploy/ctrl-c) -> close() (which saves) -> exit. Wired only
    // in the standalone entrypoint so tests don't accumulate signal handlers.
    for (const sig of ["SIGTERM", "SIGINT"]) {
      process.on(sig, async () => { await h.close(); process.exit(0); });
    }
  });
}
