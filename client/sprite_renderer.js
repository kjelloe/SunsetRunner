// client/sprite_renderer.js — draw a manifest sprite procedurally (CLIENT ONLY).
// The manifest (data/assets.json) defines each sprite's size/kind/palette; this
// draws it by kind. No atlas image is needed — the "strip" is a logical layout
// (tools/build_assets.mjs) whose width is pinned by test. Anchored bottom-centre.

export function drawSprite(g, sprite, cx, cyBottom, scale) {
  const w = Math.max(2, sprite.w * scale);
  const h = Math.max(2, sprite.h * scale);
  const x = cx - w / 2;
  const y = cyBottom - h;
  const p = sprite.palette;
  if (sprite.kind === "car") {
    g.fillStyle = p[2]; g.fillRect(x, y + h * 0.82, w, h * 0.18);      // shadow / wheels
    g.fillStyle = p[0]; g.fillRect(x, y, w, h * 0.85);                 // body
    g.fillStyle = p[1]; g.fillRect(x + w * 0.18, y, w * 0.64, h * 0.42); // roof / window
  } else if (sprite.kind === "palm") {
    g.fillStyle = p[0]; g.fillRect(cx - w * 0.08, y + h * 0.3, w * 0.16, h * 0.7); // trunk
    g.fillStyle = p[1];
    g.beginPath();
    g.moveTo(cx, y);
    g.lineTo(x, y + h * 0.35);
    g.lineTo(x + w, y + h * 0.35);
    g.closePath();
    g.fill(); // canopy
  } else if (sprite.kind === "sign") {
    g.fillStyle = p[2]; g.fillRect(cx - w * 0.06, y + h * 0.5, w * 0.12, h * 0.5); // post
    g.fillStyle = p[0]; g.fillRect(x, y, w, h * 0.5);                              // board
    g.fillStyle = p[1]; g.fillRect(x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.2);  // stripe
  } else {
    g.fillStyle = p[0]; g.fillRect(x, y, w, h);
  }
}
