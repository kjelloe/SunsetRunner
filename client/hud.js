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

export function drawHud(g, view, state, hud = {}) {
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

  const big = Math.round(view.h * 0.11); // ~3x the old speed label
  const label = Math.round(big * 0.3);
  const pad = Math.round(view.h * 0.04);
  g.textBaseline = "alphabetic";

  // SCORE — top-left (multiplayer scoreboard).
  if (hud.points != null) {
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillStyle = "#ffd54a";
    g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
    g.fillText("SCORE", 16, 14);
    g.fillStyle = "#ffffff";
    g.font = `bold ${Math.round(view.h * 0.055)}px sans-serif`;
    g.fillText(String(hud.points), 16, 14 + Math.round(view.h * 0.032));
  }
  g.textBaseline = "alphabetic";

  // SPEED — big, bottom-right.
  g.textAlign = "right";
  g.fillStyle = "#ffd54a";
  g.font = `${label}px sans-serif`;
  g.fillText("SPEED", view.w - pad, view.h - pad - big);
  g.fillStyle = "#ffffff";
  g.font = `bold ${big}px sans-serif`;
  g.fillText(`${displaySpeed(seat.speed)}`, view.w - pad, view.h - pad);

  // STAGE n / NN — same size, bottom-left, distinct colour.
  if (hud.stage) {
    g.textAlign = "left";
    g.fillStyle = "#ffd54a";
    g.font = `${label}px sans-serif`;
    g.fillText("STAGE", pad, view.h - pad - big);
    g.fillStyle = "#4cd6e0";
    g.font = `bold ${big}px sans-serif`;
    g.fillText(`${hud.stage}/${hud.total}`, pad, view.h - pad);
  }

  // FINISH / TIME UP under the timer.
  g.textAlign = "center";
  if (seat.finishTicks >= 0) {
    g.fillStyle = "#ffe14d";
    g.font = `bold ${Math.round(view.h * 0.06)}px sans-serif`;
    g.fillText("FINISH", view.w / 2, view.h * 0.33);
  } else if (seat.timedOut) {
    g.fillStyle = "#ff5252";
    g.font = `bold ${Math.round(view.h * 0.06)}px sans-serif`;
    g.fillText("TIME UP", view.w / 2, view.h * 0.33);
  }
  g.textAlign = "left";
}
