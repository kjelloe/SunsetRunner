// client/connection_banner.js — show the remote connection state (CLIENT ONLY).
// The Pitfall write-up: a visible RECONNECTING banner is "most of the perceived
// mobile quality". Pure text mapping + a thin canvas draw. Statuses come from
// session_remote: connecting | live | reconnecting | run_ended.

export function bannerText(status) {
  switch (status) {
    case "connecting": return "CONNECTING…";
    case "reconnecting": return "RECONNECTING…";
    case "run_ended": return "RUN ENDED — DROPPING YOU BACK IN…";
    default: return null; // live / idle -> no banner
  }
}

export function drawConnectionBanner(g, view, status, frame = 0) {
  const text = bannerText(status);
  if (!text) return;
  const pulse = 0.55 + 0.25 * Math.sin(frame * 0.15); // gentle attention pulse
  const h = Math.floor(view.h * 0.09);
  g.save();
  g.globalAlpha = 0.8;
  g.fillStyle = "#1a0f2e";
  g.fillRect(0, view.h / 2 - h / 2, view.w, h);
  g.globalAlpha = pulse;
  g.fillStyle = "#ffd54a";
  g.font = `bold ${Math.floor(h * 0.42)}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, view.w / 2, view.h / 2);
  g.restore();
  g.textAlign = "left";
  g.textBaseline = "top";
}
