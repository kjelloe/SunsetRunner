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
import { C2S, S2C, parseMessage } from "../shared/protocol.js";

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
  const room = createRoom(ctx, { startTimeTicks: ctx.startTimeTicks, ...roomOpts });

  const server = createServer(serveStatic);
  const wss = new WebSocketServer({ server });
  const clients = new Map(); // ws -> seatId

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = parseMessage(raw.toString());
      if (!parsed.ok) { ws.send(JSON.stringify({ type: S2C.ERROR, reason: parsed.reason })); return; }
      const msg = parsed.msg;
      if (msg.type === C2S.JOIN) {
        const seatId = room.addSeat(msg.carId);
        if (seatId === -1) { ws.send(JSON.stringify({ type: S2C.ERROR, reason: "room full" })); return; }
        clients.set(ws, seatId);
        ws.send(JSON.stringify({ type: S2C.WELCOME, seatId, courseId: room.courseId ?? 1, tick: room.tick }));
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
      if (seatId != null) room.removeSeat(seatId);
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

  await new Promise((r) => server.listen(port, r));
  return {
    room,
    port: server.address().port,
    async close() {
      clearInterval(interval);
      for (const ws of clients.keys()) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  startServer(port).then((h) => console.log(`Sunset Runner server on http://localhost:${h.port}/client/index.html`));
}
