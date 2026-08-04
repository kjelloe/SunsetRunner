// client/spectate.js — multiplayer time-up: RE-JOIN / SPECTATE buttons + the
// spectator overlay (CLIENT ONLY). Pure draw + touch-zone helpers.

export function drawTimeUpButtons(g, view, selected) {
  const bw = view.w * 0.34;
  const bh = view.h * 0.12;
  const gap = view.w * 0.06;
  const y = view.h * 0.76;
  const x0 = view.w / 2 - bw - gap / 2;
  const labels = ["RE-JOIN", "SPECTATE"];
  for (let i = 0; i < 2; i++) {
    const bx = x0 + i * (bw + gap);
    g.fillStyle = selected === i ? "#ffd54a" : "#2a2145";
    g.fillRect(bx, y, bw, bh);
    if (selected === i) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 4;
      g.strokeRect(bx, y, bw, bh);
    }
    g.fillStyle = selected === i ? "#101010" : "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `bold ${Math.round(view.h * 0.045)}px sans-serif`;
    g.fillText(labels[i], bx + bw / 2, y + bh / 2);
  }
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
}

// Which time-up button a tap hit: 0 = RE-JOIN (left), 1 = SPECTATE (right).
export function timeUpTouchZone(view, x) {
  return x < view.w / 2 ? 0 : 1;
}

// Name of the spectated player, centre-bottom, with cycle arrows + a re-join hint.
export function drawSpectateOverlay(g, view, name, index, total) {
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(view.w * 0.22, view.h * 0.82, view.w * 0.56, view.h * 0.11);
  g.fillStyle = "#ffd54a";
  g.font = `bold ${Math.round(view.h * 0.05)}px sans-serif`;
  g.fillText(`◄  SPECTATING: ${name}  ►`, view.w / 2, view.h * 0.88);
  g.fillStyle = "#cfe";
  g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
  g.fillText(`${index + 1}/${total}   —   ENTER / tap centre to re-join`, view.w / 2, view.h * 0.92);
  g.textAlign = "left";
}

// A compact live scoreboard (top players by points), top-right. Highlights you.
export function drawMiniScoreboard(g, view, scoreboard, selfSeatId) {
  if (!scoreboard || !scoreboard.length) return;
  const rows = scoreboard.slice(0, 6);
  const fs = Math.round(view.h * 0.03);
  const x = view.w - view.w * 0.02;
  g.textBaseline = "alphabetic";
  g.font = `${fs}px sans-serif`;
  rows.forEach((e, i) => {
    const y = view.h * 0.05 + i * fs * 1.25;
    g.textAlign = "left";
    g.fillStyle = e.seatId === selfSeatId ? "#ffffff" : "#cfd0e0";
    g.fillText(`${i + 1}. ${e.name}`, x - view.w * 0.24, y);
    g.textAlign = "right";
    g.fillStyle = "#ffd54a";
    g.fillText(`${e.points}`, x, y);
  });
  g.textAlign = "left";
}

// Spectate tap: left third = previous, right third = next, centre = re-join.
export function spectateTouchZone(view, x) {
  const third = view.w / 3;
  if (x < third) return "prev";
  if (x > third * 2) return "next";
  return "rejoin";
}
