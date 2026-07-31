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
  g.font = "20px monospace";
  g.textBaseline = "top";
  g.fillStyle = "#ffffff";
  g.fillText(`SPEED ${displaySpeed(seat.speed)}`, 16, 16);

  const time = displayTime(seat.timerTicks);
  g.fillStyle = time <= 5 ? "#ff5252" : "#ffffff";
  g.textAlign = "right";
  g.fillText(`TIME ${time}`, view.w - 16, 16);
  g.textAlign = "left";

  if (seat.finishTicks >= 0) {
    g.fillStyle = "#ffe14d";
    g.fillText("FINISH", 16, 44);
  } else if (seat.timedOut) {
    g.fillStyle = "#ff5252";
    g.fillText("TIME UP", 16, 44);
  }
}
