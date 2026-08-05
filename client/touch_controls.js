// client/touch_controls.js — on-screen touch controls (CLIENT ONLY).
// Pointer events over the canvas map to the same input the keyboard produces, so
// main.js merges the two. Held buttons (steer/accel/brake) track active pointers;
// fork buttons are edge-triggered (one tap = one choice). Import-safe; tested
// headlessly with synthetic pointer events (brief §17, gotcha #10).

import { STEER_UNIT } from "../shared/constants.js";

// On-screen arrow pad (fractions of the canvas). Right thumb accelerates/brakes
// ▲ ▼; fork arrows sit in the top corners. The left thumb steers via an analog
// drag PAD (see STEER_PAD) rather than discrete arrows.
export const BUTTONS = [
  { id: "accel",  x0: 0.83, x1: 0.98, y0: 0.48, y1: 0.71, label: "▲" },
  { id: "brake",  x0: 0.83, x1: 0.98, y0: 0.73, y1: 0.96, label: "▼" },
  { id: "forkL",  x0: 0.02, x1: 0.16, y0: 0.03, y1: 0.15, label: "↰" },
  { id: "forkR",  x0: 0.84, x1: 0.98, y0: 0.03, y1: 0.15, label: "↱" },
];

// Analog steering pad: touch anywhere inside, then drag left/right. Steer is the
// horizontal drag from the touch-down anchor, scaled so a full PAD_RANGE drag =
// full lock (±STEER_UNIT). Relative-to-anchor (not absolute) so the thumb never
// has to find a fixed centre — arcade wheels behave the same way.
export const STEER_PAD = { x0: 0.02, x1: 0.40, y0: 0.55, y1: 0.98 };
export const PAD_RANGE = 0.14; // fraction of canvas width dragged for full lock

const active = new Map(); // pointerId -> held button id
const steerState = { pointerId: null, anchorFx: 0, steer: 0 };
const forkQueue = [];

function inSteerPad(fx, fy) {
  return fx >= STEER_PAD.x0 && fx < STEER_PAD.x1 && fy >= STEER_PAD.y0 && fy < STEER_PAD.y1;
}

function steerFromDrag(fx) {
  const raw = Math.round(((fx - steerState.anchorFx) / PAD_RANGE) * STEER_UNIT);
  return Math.max(-STEER_UNIT, Math.min(STEER_UNIT, raw));
}

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

function releasePointer(pointerId) {
  active.delete(pointerId);
  if (steerState.pointerId === pointerId) {
    steerState.pointerId = null;
    steerState.steer = 0;
  }
}

export function installTouch(canvas) {
  const down = (e) => {
    const { fx, fy } = eventFraction(canvas, e);
    const b = hitButton(fx, fy);
    if (b) {
      if (e.preventDefault) e.preventDefault();
      if (b.id === "forkL") forkQueue.push(-1);
      else if (b.id === "forkR") forkQueue.push(1);
      else active.set(e.pointerId, b.id);
      return;
    }
    if (inSteerPad(fx, fy) && steerState.pointerId === null) {
      if (e.preventDefault) e.preventDefault();
      steerState.pointerId = e.pointerId;
      steerState.anchorFx = fx;
      steerState.steer = 0;
    }
  };
  const move = (e) => {
    if (steerState.pointerId !== e.pointerId) return;
    const { fx } = eventFraction(canvas, e);
    steerState.steer = steerFromDrag(fx);
    if (e.preventDefault) e.preventDefault();
  };
  const up = (e) => releasePointer(e.pointerId);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", up);
}

// Reduce currently-held buttons + the analog steer pad to an input frame (ints).
export function readTouchInput() {
  const held = new Set(active.values());
  return {
    steer: steerState.pointerId !== null ? steerState.steer : 0,
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
  // Analog steer pad: a faint track with a thumb dot that slides with the drag.
  {
    const x = STEER_PAD.x0 * view.w;
    const y = STEER_PAD.y0 * view.h;
    const w = (STEER_PAD.x1 - STEER_PAD.x0) * view.w;
    const h = (STEER_PAD.y1 - STEER_PAD.y0) * view.h;
    g.globalAlpha = 0.15;
    g.fillStyle = "#ffffff";
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    const cy = y + h / 2;
    g.globalAlpha = 0.35;
    g.strokeStyle = "#ffffff";
    g.beginPath();
    g.moveTo(x + 8, cy);
    g.lineTo(x + w - 8, cy);
    g.stroke();
    const frac = steerState.pointerId !== null ? steerState.steer / STEER_UNIT : 0;
    const dotX = x + w / 2 + (frac * (w / 2 - 12));
    g.globalAlpha = steerState.pointerId !== null ? 0.7 : 0.35;
    g.fillStyle = "#ffd060";
    g.beginPath();
    g.arc(dotX, cy, 14, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.6;
    g.fillStyle = "#101018";
    g.fillText("STEER", x + w / 2, y + h - 16);
  }
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
