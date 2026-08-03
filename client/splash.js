// client/splash.js — boot splash + loading bar (CLIENT ONLY, presentation).
// "SUNSET RUNNER" over a sunsetting beach with palms, and a LOADING bar that
// fills as client-side assets load. Fake-ctx-safe so it is node-testable.

function drawPalm(g, x, groundY, size) {
  // Trunk.
  g.fillStyle = "#3a2a1a";
  const tw = Math.max(2, size * 0.05);
  g.fillRect(x - tw / 2, groundY - size, tw, size);
  // Fronds — a few triangles fanning from the top.
  g.fillStyle = "#1f5a2f";
  const top = groundY - size;
  const fr = size * 0.6;
  for (const dir of [-1, 1]) {
    for (const k of [0.2, 0.55, 0.9]) {
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x + dir * fr, top - fr * (0.5 - k * 0.4));
      g.lineTo(x + dir * fr * 0.6, top + fr * 0.18);
      g.closePath();
      g.fill();
    }
  }
}

export function drawSplash(g, view, progress = 0) {
  const w = view.w;
  const h = view.h;
  const p = Math.max(0, Math.min(1, progress));

  // Sunset sky.
  const sky = g.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, "#2b1a54");
  sky.addColorStop(0.55, "#ff7e5f");
  sky.addColorStop(1, "#ffd06b");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h * 0.72);

  // Sun.
  g.fillStyle = "#ffe08a";
  g.beginPath();
  g.arc(w / 2, h * 0.52, h * 0.15, 0, Math.PI * 2);
  g.fill();

  // Sea + sand.
  g.fillStyle = "#1f6fb0";
  g.fillRect(0, h * 0.6, w, h * 0.12);
  g.fillStyle = "#e4d29a";
  g.fillRect(0, h * 0.72, w, h * 0.28);

  // Palms framing the scene.
  drawPalm(g, w * 0.14, h * 0.74, h * 0.34);
  drawPalm(g, w * 0.87, h * 0.74, h * 0.38);

  // Title.
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.font = `bold ${Math.round(h * 0.12)}px sans-serif`;
  g.fillText("SUNSET RUNNER", w / 2, h * 0.30);

  // Loading bar.
  const bw = w * 0.5;
  const bx = (w - bw) / 2;
  const bh = Math.round(h * 0.035);
  const by = h * 0.86;
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = "#ff7a3c";
  g.fillRect(bx, by, bw * p, bh);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2;
  g.strokeRect(bx, by, bw, bh);

  g.fillStyle = "#ffffff";
  g.font = `${Math.round(h * 0.03)}px sans-serif`;
  g.fillText(`LOADING ${Math.round(p * 100)}%`, w / 2, by - h * 0.03);

  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}
