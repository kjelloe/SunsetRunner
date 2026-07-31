// client/renderer_canvas.js — canvas frame composition (CLIENT ONLY).
// Draws sky, road, the player car, and the HUD. No gameplay decisions here.

import { drawRoad } from "./road_renderer.js";
import { drawHud } from "./hud.js";
import { MAX_LANE_OFFSET } from "../engine/car_physics.js";

export function render(g, view, state, courseSet) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, view.h / 2);
  sky.addColorStop(0, "#2b1a54");
  sky.addColorStop(1, "#ff7e5f");
  g.fillStyle = sky;
  g.fillRect(0, 0, view.w, view.h);

  drawRoad(g, view, state.seats[0], courseSet);
  drawPlayerCar(g, view, state.seats[0]);
  drawHud(g, view, state);
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
