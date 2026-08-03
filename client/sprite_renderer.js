// client/sprite_renderer.js — draw a manifest sprite procedurally (CLIENT ONLY).
// The manifest (data/assets.json) defines each sprite's size/kind/palette; this
// draws it by kind with a bit of shape/shading so it reads less blocky. Anchored
// bottom-centre. Paths are anti-aliased by the canvas.

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function drawSprite(g, sprite, cx, cyBottom, scale) {
  const w = Math.max(2, sprite.w * scale);
  const h = Math.max(2, sprite.h * scale);
  const x = cx - w / 2;
  const y = cyBottom - h;
  const p = sprite.palette;

  if (sprite.kind === "car") {
    // soft shadow
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(cx, cyBottom - h * 0.06, w * 0.52, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // wheels
    g.fillStyle = p[2];
    g.fillRect(x + w * 0.06, y + h * 0.72, w * 0.16, h * 0.26);
    g.fillRect(x + w * 0.78, y + h * 0.72, w * 0.16, h * 0.26);
    // body (rounded) with a top-lit gradient
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, p[0]);
    grd.addColorStop(1, p[1]);
    g.fillStyle = grd;
    roundRect(g, x, y + h * 0.18, w, h * 0.62, h * 0.22);
    g.fill();
    // cabin / windshield
    g.fillStyle = p[1];
    roundRect(g, x + w * 0.2, y, w * 0.6, h * 0.34, h * 0.14);
    g.fill();
    g.fillStyle = "rgba(180,220,255,0.85)";
    roundRect(g, x + w * 0.27, y + h * 0.05, w * 0.46, h * 0.2, h * 0.08);
    g.fill();
    // tail lights
    g.fillStyle = "#ffdd55";
    g.fillRect(x + w * 0.08, y + h * 0.5, w * 0.1, h * 0.12);
    g.fillRect(x + w * 0.82, y + h * 0.5, w * 0.1, h * 0.12);
  } else if (sprite.kind === "palm") {
    g.fillStyle = p[0];
    g.fillRect(cx - w * 0.06, y + h * 0.32, w * 0.12, h * 0.68); // trunk
    g.fillStyle = p[1];
    for (const dir of [-1, 1]) {
      for (const spread of [0.5, 0.9]) {
        g.beginPath();
        g.moveTo(cx, y + h * 0.06);
        g.quadraticCurveTo(cx + dir * w * spread * 0.7, y + h * 0.02, cx + dir * w * spread, y + h * 0.34);
        g.quadraticCurveTo(cx + dir * w * spread * 0.5, y + h * 0.2, cx, y + h * 0.14);
        g.closePath();
        g.fill();
      }
    }
  } else if (sprite.kind === "fir") {
    g.fillStyle = p[0];
    g.fillRect(cx - w * 0.06, y + h * 0.82, w * 0.12, h * 0.18); // trunk
    g.fillStyle = p[1];
    for (const [ty, tw] of [[0.08, 0.5], [0.34, 0.72], [0.6, 0.92]]) {
      g.beginPath();
      g.moveTo(cx, y + h * ty * 0.6);
      g.lineTo(cx - w * tw * 0.5, y + h * (ty + 0.3));
      g.lineTo(cx + w * tw * 0.5, y + h * (ty + 0.3));
      g.closePath();
      g.fill();
    }
    if (p[2]) { // snow cap
      g.fillStyle = p[2];
      g.beginPath();
      g.moveTo(cx, y + h * 0.05);
      g.lineTo(cx - w * 0.14, y + h * 0.2);
      g.lineTo(cx + w * 0.14, y + h * 0.2);
      g.closePath();
      g.fill();
    }
  } else if (sprite.kind === "crop") {
    g.strokeStyle = p[0];
    g.lineWidth = Math.max(1, w * 0.06);
    for (const dx of [-0.3, -0.1, 0.1, 0.3]) {
      g.beginPath();
      g.moveTo(cx + w * dx, y + h);
      g.lineTo(cx + w * dx * 0.7, y + h * 0.12);
      g.stroke();
    }
    g.fillStyle = p[1];
    for (const dx of [-0.3, -0.1, 0.1, 0.3]) {
      g.beginPath();
      g.ellipse(cx + w * dx * 0.7, y + h * 0.14, w * 0.06, h * 0.16, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (sprite.kind === "snowmobile") {
    // soft shadow
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(cx, cyBottom - h * 0.06, w * 0.5, h * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // skis
    g.fillStyle = p[2];
    g.fillRect(x, y + h * 0.72, w, h * 0.12);
    // body
    g.fillStyle = p[0];
    roundRect(g, x + w * 0.08, y + h * 0.28, w * 0.84, h * 0.5, h * 0.18);
    g.fill();
    // cowl / windshield
    g.fillStyle = p[2];
    roundRect(g, x + w * 0.5, y + h * 0.12, w * 0.34, h * 0.3, h * 0.1);
    g.fill();
    // rider
    g.fillStyle = p[1];
    g.beginPath();
    g.ellipse(cx - w * 0.05, y + h * 0.3, w * 0.12, h * 0.2, 0, 0, Math.PI * 2);
    g.fill();
  } else if (sprite.kind === "skier") {
    // skis
    g.fillStyle = p[2];
    g.fillRect(x, y + h * 0.9, w, h * 0.08);
    // legs
    g.strokeStyle = p[1];
    g.lineWidth = Math.max(1.5, w * 0.12);
    g.beginPath();
    g.moveTo(cx, y + h * 0.55);
    g.lineTo(cx - w * 0.22, y + h * 0.9);
    g.moveTo(cx, y + h * 0.55);
    g.lineTo(cx + w * 0.22, y + h * 0.9);
    g.stroke();
    // torso (jacket)
    g.fillStyle = p[0];
    roundRect(g, cx - w * 0.2, y + h * 0.2, w * 0.4, h * 0.4, w * 0.14);
    g.fill();
    // head
    g.fillStyle = p[2];
    g.beginPath();
    g.ellipse(cx, y + h * 0.12, w * 0.16, h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    // poles
    g.strokeStyle = p[1];
    g.lineWidth = Math.max(1, w * 0.05);
    g.beginPath();
    g.moveTo(cx - w * 0.28, y + h * 0.3);
    g.lineTo(cx - w * 0.34, y + h * 0.9);
    g.moveTo(cx + w * 0.28, y + h * 0.3);
    g.lineTo(cx + w * 0.34, y + h * 0.9);
    g.stroke();
  } else if (sprite.kind === "sign") {
    g.fillStyle = p[2];
    g.fillRect(cx - w * 0.05, y + h * 0.45, w * 0.1, h * 0.55); // post
    const grd = g.createLinearGradient(x, y, x, y + h * 0.5);
    grd.addColorStop(0, p[0]);
    grd.addColorStop(1, p[1]);
    g.fillStyle = grd;
    roundRect(g, x, y, w, h * 0.5, h * 0.08);
    g.fill();
  } else {
    g.fillStyle = p[0];
    g.fillRect(x, y, w, h);
  }
}
