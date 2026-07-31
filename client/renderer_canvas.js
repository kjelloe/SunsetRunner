// client/renderer_canvas.js — canvas frame composition (CLIENT ONLY).
// Draws sky, road, the player car, and the HUD. No gameplay decisions here.

import { drawRoad } from "./road_renderer.js";
import { drawHud } from "./hud.js";
import { projectPoint } from "./projection.js";
import { MAX_LANE_OFFSET } from "../engine/car_physics.js";
import { ROAD_UNIT } from "../shared/constants.js";

export function render(g, view, state, courseSet) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, view.h / 2);
  sky.addColorStop(0, "#2b1a54");
  sky.addColorStop(1, "#ff7e5f");
  g.fillStyle = sky;
  g.fillRect(0, 0, view.w, view.h);

  drawRoad(g, view, state.seats[0], courseSet);
  drawTraffic(g, view, state);
  drawGhosts(g, view, state);
  drawPlayerCar(g, view, state.seats[0]);
  drawHud(g, view, state);
}

// Rival ghosts (remote play). Same-segment, ahead of the viewer, back-to-front.
// collisionActive rivals are outlined so a same-segment bump reads on screen.
function drawGhosts(g, view, state) {
  const ghosts = state.ghosts || [];
  if (ghosts.length === 0) return;
  const seat = state.seats[0];
  const ahead = ghosts
    .filter((r) => r.segmentId === seat.segmentId && r.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const r of ahead) {
    const dz = r.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const p = projectPoint(view, seat.laneX, 0, r.laneX, 0, dz);
    const w = Math.max(4, Math.abs(p.w) >> 3);
    const h = Math.max(3, Math.floor(w * 0.6));
    g.globalAlpha = 0.6;
    g.fillStyle = "#9a5cff";
    g.fillRect(p.x - w / 2, p.y - h, w, h);
    g.globalAlpha = 1;
    if (r.collisionActive) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2;
      g.strokeRect(p.x - w / 2, p.y - h, w, h);
    }
  }
}

// Approximate: draws traffic in the player's current segment that is ahead of
// them, back-to-front. Exact placement waits on the native visual-tuning pass.
function drawTraffic(g, view, state) {
  const seat = state.seats[0];
  const ahead = state.traffic
    .filter((t) => t.segmentId === seat.segmentId && t.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const t of ahead) {
    const dz = t.roadZ - seat.roadZ;
    const p = projectPoint(view, seat.laneX, 0, t.laneX, 0, dz);
    if (dz < ROAD_UNIT) continue;
    const w = Math.max(4, Math.abs(p.w) >> 3);
    const h = Math.max(3, Math.floor(w * 0.6));
    g.fillStyle = t.kind === 2 ? "#3a6ea5" : "#e0c040";
    g.fillRect(p.x - w / 2, p.y - h, w, h);
  }
}

function drawPlayerCar(g, view, seat) {
  const carW = Math.floor(view.w * 0.16);
  const carH = Math.floor(carW * 0.5);
  // laneX maps [-MAX, MAX] to a fraction of the lower screen width.
  const cx = view.w / 2 + (seat.laneX / MAX_LANE_OFFSET) * (view.w * 0.22);
  const cy = view.h - carH - 24;
  g.fillStyle = "#d02b2b";
  g.fillRect(Math.round(cx - carW / 2), cy, carW, carH);
  g.fillStyle = "#1a1a1a";
  g.fillRect(Math.round(cx - carW / 2), cy + carH - 6, carW, 8);
}
