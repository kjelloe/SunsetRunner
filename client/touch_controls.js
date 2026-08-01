// client/touch_controls.js — on-screen touch controls (CLIENT ONLY).
// Pointer events over the canvas map to the same input the keyboard produces, so
// main.js merges the two. Held buttons (steer/accel/brake) track active pointers;
// fork buttons are edge-triggered (one tap = one choice). Import-safe; tested
// headlessly with synthetic pointer events (brief §17, gotcha #10).

// On-screen arrow pad (fractions of the canvas). Left thumb steers ◄ ►, right
// thumb accelerates/brakes ▲ ▼; fork arrows sit in the top corners.
export const BUTTONS = [
  { id: "steerL", x0: 0.02, x1: 0.17, y0: 0.62, y1: 0.95, label: "◄" },
  { id: "steerR", x0: 0.19, x1: 0.34, y0: 0.62, y1: 0.95, label: "►" },
  { id: "accel",  x0: 0.83, x1: 0.98, y0: 0.48, y1: 0.71, label: "▲" },
  { id: "brake",  x0: 0.83, x1: 0.98, y0: 0.73, y1: 0.96, label: "▼" },
  { id: "forkL",  x0: 0.02, x1: 0.16, y0: 0.03, y1: 0.15, label: "↰" },
  { id: "forkR",  x0: 0.84, x1: 0.98, y0: 0.03, y1: 0.15, label: "↱" },
];

const active = new Map(); // pointerId -> held button id
const forkQueue = [];

function hitButton(fx, fy) {
  for (const b of BUTTONS) {
    if (fx >= b.x0 && fx < b.x1 && fy >= b.y0 && fy < b.y1) return b;
  }
  return null;
}

// Map a pointer event to canvas-fraction coords. Uses the canvas bounding rect +
// clientX/Y so it is correct even when the canvas is CSS-scaled to fit a phone
// (the drawing buffer size differs from the displayed CSS size — gotcha #9).
// Falls back to offsetX/buffer-size when no rect is available (older paths/tests).
export function eventFraction(canvas, e) {
  if (e.clientX != null && typeof canvas.getBoundingClientRect === "function") {
    const r = canvas.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
    }
  }
  const w = canvas.width || 1;
  const h = canvas.height || 1;
  return { fx: (e.offsetX || 0) / w, fy: (e.offsetY || 0) / h };
}

export function installTouch(canvas) {
  const down = (e) => {
    const { fx, fy } = eventFraction(canvas, e);
    const b = hitButton(fx, fy);
    if (!b) return;
    if (e.preventDefault) e.preventDefault();
    if (b.id === "forkL") forkQueue.push(-1);
    else if (b.id === "forkR") forkQueue.push(1);
    else active.set(e.pointerId, b.id);
  };
  const up = (e) => active.delete(e.pointerId);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", up);
}

// Reduce currently-held buttons to an input frame (integers).
export function readTouchInput() {
  const held = new Set(active.values());
  return {
    steer: (held.has("steerR") ? 1 : 0) - (held.has("steerL") ? 1 : 0),
    accel: held.has("accel") ? 1 : 0,
    brake: held.has("brake") ? 1 : 0,
  };
}

export function readTouchFork() {
  return forkQueue.length ? forkQueue.shift() : 0;
}

export function touchDetected() {
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in globalThis);
}

// Draw the button overlay (faint; brighter while held).
export function drawTouchControls(g, view) {
  const held = new Set(active.values());
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "20px monospace";
  for (const b of BUTTONS) {
    const x = b.x0 * view.w;
    const y = b.y0 * view.h;
    const w = (b.x1 - b.x0) * view.w;
    const h = (b.y1 - b.y0) * view.h;
    g.globalAlpha = held.has(b.id) ? 0.45 : 0.2;
    g.fillStyle = "#ffffff";
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.globalAlpha = 0.9;
    g.fillStyle = "#101018";
    g.fillText(b.label, x + w / 2, y + h / 2);
  }
  g.restore();
}
