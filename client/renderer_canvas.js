// client/renderer_canvas.js — canvas frame composition (CLIENT ONLY).
// Sky, road, scenery, traffic, ghosts, player car, HUD. No gameplay decisions.
// Lateral model: everything sits at a LANE FRACTION of the projected road width
// at its depth (`onRoad`), so laneX = ROAD_HALF_WIDTH is exactly the road edge and
// the player + traffic share one coordinate (you can line up a dodge). The camera
// follows the player only partially (CAM_FOLLOW) so drift stays visible on screen.

import { drawRoad, forwardStrips } from "./road_renderer.js";
import { drawHud } from "./hud.js";
import { drawSprite } from "./sprite_renderer.js";
import { projectPoint } from "./projection.js";
import { ROAD_HALF_WIDTH } from "../engine/car_physics.js";
import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment } from "../shared/road_data.js";
import { themeFor } from "./scenery.js";
import { carColor } from "./car_colors.js";
import { TUNING } from "./tuning.js";
import { drawForkPreview } from "./fork_preview.js";
import { checkpointAhead, CHECKPOINT_DRAW_RANGE } from "./checkpoint_banner.js";

const TRAFFIC_SPRITE = { 1: "traffic_sedan", 2: "traffic_truck" };

// Project a point at lateral `laneX` onto the road at forward distance `dz`,
// relative to the CURVED road centre (curveX) and its hill (hillY) at that depth,
// so entities follow the road's bends and rises. Returns screen x (lane fraction
// of the road half-width), road y, half-width px, and perspective scale.
export function onRoad(view, camX, dz, laneX, curveX = 0, hillY = 0) {
  const p = projectPoint(view, camX, 0, curveX, hillY, dz); // curved road centre at this depth
  const half = Math.abs(p.w);
  return { x: p.x + (laneX / ROAD_HALF_WIDTH) * half, y: p.y, half, scale: p.scale };
}

// The curve/hill of the road at forward distance `dz`, read off the strip list.
function sampleStrip(strips, dz) {
  if (strips.length === 0) return { curveX: 0, hillY: 0 };
  const k = Math.max(0, Math.min(strips.length - 1, Math.round((dz - strips[0].worldZ) / ROAD_UNIT)));
  return { curveX: strips[k].curveX, hillY: strips[k].hillY };
}

export function render(g, view, state, courseSet, assets, scenery) {
  const seat = state.seats[0];
  const camX = seat.laneX * TUNING.camFollow;
  const strips = forwardStrips(courseSet, seat.segmentId, seat.roadZ, 220);

  // Per-leg theme (beach/canyon/forest after forks) off the current segment's
  // scenerySet — renderer-only, no engine coupling.
  const seg = seat.segmentId !== -1 ? getSegment(courseSet, seat.segmentId) : null;
  const theme = themeFor(scenery, seg ? seg.scenerySet : 0);
  // Per-terrain road width (wide easy stages, slim mountain/alpine) — override the
  // (possibly ?tune'd) base for this frame, restored at the end of render().
  const baseRoadWidth = TUNING.roadWidth;
  TUNING.roadWidth = Math.round(baseRoadWidth * (theme.roadScale ?? 1));

  const sky = g.createLinearGradient(0, 0, 0, view.h / 2);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(1, theme.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, view.w, view.h);

  drawRoad(g, view, seat, courseSet, camX, theme);
  drawHaze(g, view);
  if (assets) drawScenery(g, view, camX, assets, strips, theme);
  drawCheckpointBanner(g, view, camX, strips, seat, courseSet);
  drawTraffic(g, view, state, camX, assets, strips);
  drawGhosts(g, view, state, camX, strips);
  drawPlayerCar(g, view, seat, camX, assets);
  drawHud(g, view, state);
  drawForkPreview(g, view, seat, courseSet, scenery);
  TUNING.roadWidth = baseRoadWidth; // restore the base width for the next frame
}

function drawScenery(g, view, camX, assets, strips, theme) {
  const every = theme.every;
  const kinds = theme.sprites;
  for (let i = strips.length - 1; i >= 0; i--) {
    const s = strips[i];
    if (s.worldStrip % every !== 0) continue;
    const bucket = Math.floor(s.worldStrip / every);
    const side = bucket % 2 === 0 ? -1 : 1;
    const o = onRoad(view, camX, s.worldZ, side * ROAD_HALF_WIDTH * 1.7, s.curveX, s.hillY); // off the (curved) shoulder
    if (o.half <= 0) continue;
    const sprite = assets.sprites[kinds[bucket % kinds.length]];
    drawSprite(g, sprite, o.x, o.y, spriteScale(o.half, sprite, 0.9));
  }
}

// A checkpoint gantry at the upcoming checkpoint boundary: two posts at the road
// edges and a CHECKPOINT banner slung between them at tree-line height.
function drawCheckpointBanner(g, view, camX, strips, seat, courseSet) {
  const ca = checkpointAhead(courseSet, seat);
  if (!ca || ca.distance < ROAD_UNIT || ca.distance > CHECKPOINT_DRAW_RANGE) return;
  const s = sampleStrip(strips, ca.distance);
  const edge = ROAD_HALF_WIDTH * 1.15;
  const left = onRoad(view, camX, ca.distance, -edge, s.curveX, s.hillY);
  const right = onRoad(view, camX, ca.distance, edge, s.curveX, s.hillY);
  if (left.half <= 0) return;
  const postH = left.half * 1.7; // up to tree-line height, scaled by perspective
  const postW = Math.max(2, left.half * 0.12);
  // Posts.
  g.fillStyle = "#e8e8ec";
  g.fillRect(left.x - postW / 2, left.y - postH, postW, postH);
  g.fillRect(right.x - postW / 2, right.y - postH, postW, postH);
  // Banner slung between the post tops.
  const topY = Math.min(left.y, right.y) - postH;
  const bh = Math.max(6, left.half * 0.55);
  const bx = Math.min(left.x, right.x);
  const bw = Math.abs(right.x - left.x);
  g.fillStyle = "#1a3f8a";
  g.fillRect(bx, topY, bw, bh);
  g.fillStyle = "#ffe14d";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `bold ${Math.round(bh * 0.7)}px sans-serif`;
  g.fillText("CHECKPOINT", (left.x + right.x) / 2, topY + bh / 2);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function drawTraffic(g, view, state, camX, assets, strips) {
  const seat = state.seats[0];
  const ahead = state.traffic
    .filter((t) => t.segmentId === seat.segmentId && t.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const t of ahead) {
    const dz = t.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const s = sampleStrip(strips, dz);
    const o = onRoad(view, camX, dz, t.laneX, s.curveX, s.hillY);
    if (assets) {
      const sprite = assets.sprites[TRAFFIC_SPRITE[t.kind] || "traffic_sedan"];
      drawSprite(g, sprite, o.x, o.y, spriteScale(o.half, sprite, 0.55));
    } else {
      const w = Math.max(4, o.half * 0.5);
      g.fillStyle = t.kind === 2 ? "#3a6ea5" : "#e0c040";
      g.fillRect(o.x - w / 2, o.y - w * 0.6, w, w * 0.6);
    }
  }
}

function drawGhosts(g, view, state, camX, strips) {
  const ghosts = state.ghosts || [];
  if (ghosts.length === 0) return;
  const seat = state.seats[0];
  const ahead = ghosts
    .filter((r) => r.segmentId === seat.segmentId && r.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const r of ahead) {
    const dz = r.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const s = sampleStrip(strips, dz);
    const o = onRoad(view, camX, dz, r.laneX, s.curveX, s.hillY);
    const w = Math.max(4, o.half * 0.5);
    const h = w * 0.6;
    g.globalAlpha = 0.7;
    g.fillStyle = carColor(r.carId); // rival identity: tint the ghost by its car
    g.fillRect(o.x - w / 2, o.y - h, w, h);
    g.globalAlpha = 1;
    if (r.collisionActive) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2;
      g.strokeRect(o.x - w / 2, o.y - h, w, h);
    }
  }
}

function drawPlayerCar(g, view, seat, camX, assets) {
  const o = onRoad(view, camX, TUNING.playerNearZ, seat.laneX);
  const cy = view.h - 22; // pinned near the bottom of the screen
  if (assets) {
    drawSprite(g, assets.sprites.player_car, o.x, cy, view.w * 0.0028);
    return;
  }
  const carW = Math.floor(view.w * 0.17);
  const carH = Math.floor(carW * 0.5);
  g.fillStyle = "#d02b2b";
  g.fillRect(Math.round(o.x - carW / 2), cy - carH, carW, carH);
}

// Sprite scale so its width is `frac` of the projected road half-width.
function spriteScale(roadHalfPx, sprite, frac) {
  return Math.max(0.02, (roadHalfPx * frac) / sprite.w);
}

function drawHaze(g, view) {
  const band = view.h * 0.12;
  const grd = g.createLinearGradient(0, view.h / 2 - band, 0, view.h / 2 + band);
  grd.addColorStop(0, "rgba(255,150,110,0.0)");
  grd.addColorStop(0.5, "rgba(255,150,110,0.35)");
  grd.addColorStop(1, "rgba(255,150,110,0.0)");
  g.fillStyle = grd;
  g.fillRect(0, view.h / 2 - band, view.w, band * 2);
}

