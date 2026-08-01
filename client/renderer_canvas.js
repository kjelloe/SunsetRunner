// client/renderer_canvas.js — canvas frame composition (CLIENT ONLY).
// Draws sky, road, the player car, and the HUD. No gameplay decisions here.

import { drawRoad, forwardStrips } from "./road_renderer.js";
import { drawHud } from "./hud.js";
import { drawSprite } from "./sprite_renderer.js";
import { projectPoint, CAMERA } from "./projection.js";
import { MAX_LANE_OFFSET } from "../engine/car_physics.js";
import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment } from "../shared/road_data.js";

const TRAFFIC_SPRITE = { 1: "traffic_sedan", 2: "traffic_truck" };

export function render(g, view, state, courseSet, assets) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, view.h / 2);
  sky.addColorStop(0, "#2b1a54");
  sky.addColorStop(1, "#ff7e5f");
  g.fillStyle = sky;
  g.fillRect(0, 0, view.w, view.h);

  drawRoad(g, view, state.seats[0], courseSet);
  if (assets) drawScenery(g, view, state.seats[0], courseSet, assets);
  drawTraffic(g, view, state, assets);
  drawGhosts(g, view, state);
  drawPlayerCar(g, view, state.seats[0], assets);
  drawHud(g, view, state);
  drawForkHint(g, view, state.seats[0], courseSet);
}

// Roadside palms/signs, placed deterministically every SCENERY_EVERY strips,
// alternating sides, projected onto the shoulder. Back-to-front.
const SCENERY_EVERY = 24;
function drawScenery(g, view, seat, courseSet, assets) {
  const strips = forwardStrips(courseSet, seat.segmentId, seat.roadZ, 200);
  for (let i = strips.length - 1; i >= 0; i--) {
    const s = strips[i];
    const stripNo = Math.floor(s.worldZ / ROAD_UNIT);
    if (stripNo % SCENERY_EVERY !== 0) continue;
    const side = (stripNo / SCENERY_EVERY) % 2 === 0 ? -1 : 1;
    const worldX = s.curveX + side * (CAMERA.roadWidth * 1.6);
    const p = projectPoint(view, seat.laneX, 0, worldX, s.hillY, s.worldZ);
    if (p.scale <= 0) continue;
    const sprite = assets.sprites[side < 0 ? "palm" : "sign"];
    drawSprite(g, sprite, p.x, p.y, p.scale * 10);
  }
}

// Show a fork prompt when the current or next segment is a fork.
function drawForkHint(g, view, seat, courseSet) {
  if (seat.segmentId === -1) return;
  const cur = getSegment(courseSet, seat.segmentId);
  const isFork = (s) => s && (s.forkLeft >= 0 || s.forkRight >= 0);
  const nextSeg = cur.next > 0 ? getSegment(courseSet, cur.next) : null;
  if (!isFork(cur) && !isFork(nextSeg)) return;
  g.font = "24px monospace";
  g.textAlign = "center";
  g.fillStyle = "#ffe14d";
  g.fillText("◄ Q     FORK     E ►", view.w / 2, 72);
  g.textAlign = "left";
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

// Traffic in the player's current segment ahead of them, back-to-front, drawn
// as manifest sprites (falls back to a coloured rect if no manifest is passed).
function drawTraffic(g, view, state, assets) {
  const seat = state.seats[0];
  const ahead = state.traffic
    .filter((t) => t.segmentId === seat.segmentId && t.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const t of ahead) {
    const dz = t.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const p = projectPoint(view, seat.laneX, 0, t.laneX, 0, dz);
    if (assets) {
      drawSprite(g, assets.sprites[TRAFFIC_SPRITE[t.kind] || "traffic_sedan"], p.x, p.y, p.scale * 6);
    } else {
      const w = Math.max(4, Math.abs(p.w) >> 3);
      g.fillStyle = t.kind === 2 ? "#3a6ea5" : "#e0c040";
      g.fillRect(p.x - w / 2, p.y - Math.floor(w * 0.6), w, Math.floor(w * 0.6));
    }
  }
}

function drawPlayerCar(g, view, seat, assets) {
  // laneX maps [-MAX, MAX] to a fraction of the lower screen width.
  const cx = view.w / 2 + (seat.laneX / MAX_LANE_OFFSET) * (view.w * 0.22);
  const cy = view.h - 24;
  if (assets) {
    drawSprite(g, assets.sprites.player_car, cx, cy, view.w * 0.0026);
    return;
  }
  const carW = Math.floor(view.w * 0.16);
  const carH = Math.floor(carW * 0.5);
  g.fillStyle = "#d02b2b";
  g.fillRect(Math.round(cx - carW / 2), cy - carH, carW, carH);
}
