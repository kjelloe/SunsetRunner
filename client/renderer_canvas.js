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

const TRAFFIC_SPRITE = { 1: "traffic_sedan", 2: "traffic_truck", 3: "traffic_bus", 4: "traffic_motorcycle" };

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

export function render(g, view, state, courseSet, assets, scenery, hud) {
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
  drawBoostPads(g, view, camX, strips, seat, courseSet);
  drawTraffic(g, view, state, camX, assets, strips);
  drawHazards(g, view, state, camX, assets, strips);
  drawGhosts(g, view, state, camX, strips, assets);
  drawPlayerCar(g, view, seat, camX, assets);
  drawBoostEffect(g, view, seat);
  drawHud(g, view, state, hud);
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
  if (!ca || ca.distance > CHECKPOINT_DRAW_RANGE) return; // visible from horizon until passed
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

// Boost pads (marker-0097): fixed course-data markers drawn as a glowing cyan
// double-chevron on the road at their lane. Purely presentation — the engine
// reads the same data authoritatively.
function drawBoostPads(g, view, camX, strips, seat, courseSet) {
  if (seat.segmentId === -1) return;
  const seg = getSegment(courseSet, seat.segmentId);
  const pads = seg && seg.boostPads;
  if (!pads || pads.length === 0) return;
  for (const pad of pads) {
    const dz = pad.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT || dz > 220 * ROAD_UNIT) continue;
    const s = sampleStrip(strips, dz);
    const o = onRoad(view, camX, dz, pad.laneX, s.curveX, s.hillY);
    const w = Math.max(6, o.half * 0.7);
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = "#28e0ff";
    g.shadowColor = "#28e0ff";
    g.shadowBlur = w * 0.6;
    for (let k = 0; k < 2; k++) {           // a forward-pointing double chevron
      const y = o.y - k * w * 0.5;
      g.beginPath();
      g.moveTo(o.x, y - w * 0.35);
      g.lineTo(o.x + w * 0.5, y);
      g.lineTo(o.x, y - w * 0.1);
      g.lineTo(o.x - w * 0.5, y);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
}

// While the local car is boosting, radiate cyan speed streaks from the centre.
function drawBoostEffect(g, view, seat) {
  if (!seat || !(seat.boostTicks > 0)) return;
  const cx = view.w / 2, cy = view.h * 0.62;
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = "#7ff0ff";
  g.lineWidth = Math.max(1, view.h * 0.004);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (seat.boostTicks % 4) * 0.2;
    const r0 = view.h * 0.18, r1 = view.h * 0.42;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }
  g.restore();
}

// Client-defined traffic sprites — varied shapes + per-type on-screen size, kept OUT
// of the asset manifest so the content hash is unaffected. kind 1 car (->sedan/estate/
// sport by id), 2 lorry, 3 bus, 4 motorbike. `frac` = fraction of the road half-width,
// so bigger vehicles read bigger AND everything is smaller than the old flat 0.55.
const TRAFFIC_VARIANTS = {
  1: [
    { kind: "car", w: 48, h: 28, frac: 0.3 },
    { kind: "estate", w: 50, h: 30, frac: 0.32 },
    { kind: "sport", w: 50, h: 26, frac: 0.3 },
  ],
  2: [{ kind: "truck", w: 54, h: 44, frac: 0.42 }],
  3: [{ kind: "bus", w: 60, h: 46, frac: 0.5 }],
  4: [{ kind: "moto", w: 26, h: 30, frac: 0.2 }],
};
const TRAFFIC_COLORS = ["#3a6ea5", "#e0c040", "#5aa05a", "#c85a8a", "#c8823a", "#8a8a9a"];
const TRAFFIC_CACHE = new Map();
function trafficSprite(kind, id) {
  const seed = (((id | 0) % 6) + 6) % 6;
  const key = kind + ":" + seed;
  let sprite = TRAFFIC_CACHE.get(key);
  if (sprite) return sprite;
  const variants = TRAFFIC_VARIANTS[kind] || TRAFFIC_VARIANTS[1];
  const base = variants[seed % variants.length];
  const c = TRAFFIC_COLORS[seed];
  sprite = { w: base.w, h: base.h, kind: base.kind, frac: base.frac, palette: [c, darken(c, 0.42), "#141414"] };
  TRAFFIC_CACHE.set(key, sprite);
  return sprite;
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
    const sprite = trafficSprite(t.kind, t.id ?? 0);
    drawSprite(g, sprite, o.x, o.y, spriteScale(o.half, sprite, sprite.frac));
  }
}

const HAZARD_SPRITE = { 3: "snowmobile", 4: "skier" };
function drawHazards(g, view, state, camX, assets, strips) {
  const seat = state.seats[0];
  const ahead = (state.hazards || [])
    .filter((h) => h.segmentId === seat.segmentId && h.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const h of ahead) {
    const dz = h.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const s = sampleStrip(strips, dz);
    const o = onRoad(view, camX, dz, h.laneX, s.curveX, s.hillY);
    const sprite = assets && assets.sprites[HAZARD_SPRITE[h.kind]];
    if (sprite) {
      drawSprite(g, sprite, o.x, o.y, spriteScale(o.half, sprite, 0.5));
    } else {
      const w = Math.max(4, o.half * 0.4);
      g.fillStyle = h.kind === 4 ? "#e04a8a" : "#303040"; // skier pink / snowmobile dark
      g.fillRect(o.x - w / 2, o.y - w, w, w);
    }
  }
}

const playerLabel = (r) => r.name || `P${r.seatId}`;
const progressOf = (r) => r.segmentId * 1000000 + r.roadZ;

// Darken a #rrggbb hex toward black by `f` (0..1) — for the rival car's body
// shade so the tinted sprite reads with the same top-lit gradient as the player.
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const gg = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, "0")}`;
}

// A rival car sprite tinted to its identity colour (same "car" shape as the
// player, so rivals read as cars, not rectangles). Cached per carId.
const RIVAL_SPRITE_CACHE = new Map();
function rivalCarSprite(carId, base) {
  if (RIVAL_SPRITE_CACHE.has(carId)) return RIVAL_SPRITE_CACHE.get(carId);
  const c = carColor(carId);
  const sprite = { w: base?.w || 64, h: base?.h || 32, kind: "car", palette: [c, darken(c, 0.45), "#141414"] };
  RIVAL_SPRITE_CACHE.set(carId, sprite);
  return sprite;
}

function drawGhosts(g, view, state, camX, strips, assets) {
  const ghosts = state.ghosts || [];
  if (ghosts.length === 0) return;
  const seat = state.seats[0];

  // In-view rivals (same segment ahead): draw the car + a NAME TAG that scales
  // with the car as it nears from the horizon.
  const inView = ghosts
    .filter((r) => r.segmentId === seat.segmentId && r.roadZ > seat.roadZ)
    .sort((a, b) => b.roadZ - a.roadZ);
  for (const r of inView) {
    const dz = r.roadZ - seat.roadZ;
    if (dz < ROAD_UNIT) continue;
    const s = sampleStrip(strips, dz);
    const o = onRoad(view, camX, dz, r.laneX, s.curveX, s.hillY);
    let h;
    if (assets) {
      const sprite = rivalCarSprite(r.carId, assets.sprites.player_car);
      const scale = spriteScale(o.half, sprite, 0.36); // was 0.62 — rivals were too big
      h = sprite.h * scale;
      drawSprite(g, sprite, o.x, o.y, scale); // bottom-anchored at the road point
      if (r.collisionActive) {
        // Crash SHEEN over the car's SHAPE (redraw white), not a bounding-box rect.
        const flash = { ...sprite, palette: ["#ffffff", "#ededed", "#d8d8d8"] };
        g.globalAlpha = 0.5;
        drawSprite(g, flash, o.x, o.y, scale);
        g.globalAlpha = 1;
      }
    } else {
      const w = Math.max(4, o.half * 0.5);
      h = w * 0.6;
      g.globalAlpha = 0.7;
      g.fillStyle = carColor(r.carId);
      g.fillRect(o.x - w / 2, o.y - h, w, h);
      g.globalAlpha = 1;
    }
    // Name tag above the car, scaled by the projected size.
    const fs = Math.max(8, o.half * 0.5);
    g.font = `bold ${Math.round(fs)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    const name = playerLabel(r);
    const tw = g.measureText ? g.measureText(name).width : name.length * fs * 0.6;
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(o.x - tw / 2 - fs * 0.3, o.y - h - fs * 1.3, tw + fs * 0.6, fs * 1.2);
    g.fillStyle = carColor(r.carId);
    g.fillText(name, o.x, o.y - h - fs * 0.45);
    g.textAlign = "left";
  }

  // Rivals ahead but out of view (further along the course): a small dot + name
  // near the horizon, in race order.
  const selfProgress = progressOf(seat);
  const farAhead = ghosts
    .filter((r) => r.segmentId !== seat.segmentId && progressOf(r) > selfProgress)
    .sort((a, b) => progressOf(a) - progressOf(b))
    .slice(0, 5);
  const fs = Math.round(view.h * 0.022);
  g.font = `${fs}px sans-serif`;
  farAhead.forEach((r, i) => {
    const y = view.h * 0.44 + i * fs * 1.3;
    g.fillStyle = carColor(r.carId);
    g.beginPath();
    g.arc(view.w / 2 - fs, y - fs * 0.3, Math.max(2, fs * 0.3), 0, Math.PI * 2);
    g.fill();
    g.textAlign = "left";
    g.fillText(playerLabel(r), view.w / 2 - fs * 0.4, y);
  });
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

