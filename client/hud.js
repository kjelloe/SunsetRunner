// client/hud.js — heads-up display (CLIENT ONLY). Presentation of engine state.

import { SPEED_SCALE, TICK_HZ } from "../shared/constants.js";

// Convert internal fixed-point speed to a displayed km/h-ish number. Purely
// cosmetic — never feeds back into the sim.
export function displaySpeed(speed) {
  return Math.round((speed * TICK_HZ) / SPEED_SCALE);
}

export function drawHud(g, view, state) {
  const seat = state.seats[0];
  g.font = "20px monospace";
  g.textBaseline = "top";
  g.fillStyle = "#ffffff";
  g.fillText(`SPEED ${displaySpeed(seat.speed)}`, 16, 16);
  if (seat.finishTicks >= 0) {
    g.fillStyle = "#ffe14d";
    g.fillText("FINISH", 16, 44);
  }
}
