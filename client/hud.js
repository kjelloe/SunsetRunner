// client/hud.js — heads-up display (CLIENT ONLY). Presentation of engine state.

import { SPEED_SCALE, TICK_HZ } from "../shared/constants.js";

// Convert internal fixed-point speed to a displayed km/h-ish number. Purely
// cosmetic — never feeds back into the sim.
export function displaySpeed(speed) {
  return Math.round((speed * TICK_HZ) / SPEED_SCALE);
}

// Remaining time, rounded up to whole seconds.
export function displayTime(timerTicks) {
  return Math.ceil(timerTicks / TICK_HZ);
}

export function drawHud(g, view, state) {
  const seat = state.seats[0];

  // Big TIME readout — the thing the player watches — centred in the top 25%.
  const time = displayTime(seat.timerTicks);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `bold ${Math.round(view.h * 0.16)}px sans-serif`;
  g.fillStyle = time <= 5 ? "#ff5252" : "#ffffff";
  g.fillText(String(Math.max(0, time)), view.w / 2, view.h * 0.13);
  g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
  g.fillStyle = "#ffd54a";
  g.fillText("TIME", view.w / 2, view.h * 0.24);

  // SPEED stays small, top-left.
  g.textAlign = "left";
  g.textBaseline = "top";
  g.font = "20px monospace";
  g.fillStyle = "#ffffff";
  g.fillText(`SPEED ${displaySpeed(seat.speed)}`, 16, 16);

  if (seat.finishTicks >= 0) {
    g.fillStyle = "#ffe14d";
    g.fillText("FINISH", 16, 44);
  } else if (seat.timedOut) {
    g.fillStyle = "#ff5252";
    g.fillText("TIME UP", 16, 44);
  }
}
