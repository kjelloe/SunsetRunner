// client/lobby.js — pre-race lobby screen (CLIENT ONLY): auto-start countdown,
// START NOW / WAIT buttons, and an INVITE panel with the join link + a QR code
// (vendored qrcode-generator, mirroring RetroMultiCiv). Canvas-drawn; pure zone
// helpers are testable (the QR lib guards its own import).

import qrcode from "./vendor/qrcode.min.js";

// The link a friend opens to join THIS server's lobby.
export function inviteUrl() {
  const loc = (typeof location !== "undefined") ? location : { origin: "", pathname: "/client/index.html" };
  return `${loc.origin}${loc.pathname}?mode=remote`;
}

let _url = null;
let _qr = null;
function qrFor(url) {
  if (url === _url && _qr) return _qr;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  _url = url; _qr = qr;
  return qr;
}

const BUTTONS = ["START NOW", "WAIT", "INVITE"];

// Which button a tap hit (thirds of the button band), or "closeqr" if the QR
// overlay is open (any tap closes it).
export function lobbyTouchZone(view, x, showQR) {
  if (showQR) return "closeqr";
  const third = view.w / 3;
  if (x < third) return "start";
  if (x < third * 2) return "wait";
  return "invite";
}

function drawQrPanel(g, view, url) {
  g.fillStyle = "rgba(6,4,18,0.94)";
  g.fillRect(0, 0, view.w, view.h);
  g.textAlign = "center";
  g.fillStyle = "#ffd54a";
  g.font = `${Math.round(view.h * 0.05)}px sans-serif`;
  g.fillText("SCAN TO JOIN", view.w / 2, view.h * 0.12);
  const qr = qrFor(url);
  const n = qr.getModuleCount();
  const quiet = 2;
  const size = Math.min(view.w, view.h) * 0.5;
  const scale = size / (n + quiet * 2);
  const ox = (view.w - size) / 2;
  const oy = view.h * 0.18;
  g.fillStyle = "#ffffff";
  g.fillRect(ox, oy, size, size);
  g.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) g.fillRect(ox + (c + quiet) * scale, oy + (r + quiet) * scale, scale + 0.5, scale + 0.5);
    }
  }
  g.fillStyle = "#cfe";
  g.font = `${Math.round(view.h * 0.028)}px monospace`;
  g.fillText(url, view.w / 2, oy + size + view.h * 0.06);
  g.fillStyle = "#ffd54a";
  g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
  g.fillText("tap / press any key to close", view.w / 2, view.h * 0.92);
  g.textAlign = "left";
}

export function drawLobby(g, view, info, opts = {}) {
  g.fillStyle = "#1a1030";
  g.fillRect(0, 0, view.w, view.h);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  g.fillStyle = "#ffd54a";
  g.font = `${Math.round(view.h * 0.06)}px sans-serif`;
  g.fillText("LOBBY", view.w / 2, view.h * 0.13);

  g.fillStyle = info.paused ? "#cfd0e0" : "#ffffff";
  g.font = `bold ${Math.round(view.h * 0.09)}px sans-serif`;
  g.fillText(info.paused ? "WAITING FOR PLAYERS" : `STARTS IN ${info.seconds}s`, view.w / 2, view.h * 0.29);

  const players = info.players || [];
  g.fillStyle = "#cfe";
  g.font = `${Math.round(view.h * 0.035)}px sans-serif`;
  g.fillText(`${players.length} in lobby: ${players.join(", ") || "—"}`, view.w / 2, view.h * 0.4);

  // Three buttons.
  const n = BUTTONS.length;
  const gap = view.w * 0.03;
  const bw = (view.w * 0.85 - gap * (n - 1)) / n;
  const x0 = view.w * 0.075;
  const by = view.h * 0.56;
  const bh = view.h * 0.14;
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * (bw + gap);
    g.fillStyle = "#2a2145";
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = "#ffd54a";
    g.lineWidth = 2;
    g.strokeRect(bx, by, bw, bh);
    g.fillStyle = "#ffffff";
    g.font = `bold ${Math.round(view.h * 0.04)}px sans-serif`;
    g.textBaseline = "middle";
    g.fillText(i === 1 && info.paused ? "RESUME" : BUTTONS[i], bx + bw / 2, by + bh / 2);
    g.textBaseline = "alphabetic";
  }

  if (opts.showQR) drawQrPanel(g, view, opts.url || inviteUrl());
  g.textAlign = "left";
}
