// client/touch_controls.js — on-screen touch controls (CLIENT ONLY).
// Pointer events over the canvas map to the same input the keyboard produces, so
// main.js merges the two. Three controls: a STEERING WHEEL (bottom-centre, top
// half visible — drag left/right to steer), a set-speed THROTTLE LEVER (right —
// drag the knob to a cruise speed the car holds, so the player never holds a
// button), and edge-triggered FORK buttons (top corners, one tap = one choice).
// The lever reports a target-speed FRACTION; main.js converts it to accel/brake
// against the live car speed (keeps the engine untouched + deterministic).
// Import-safe; tested headlessly with synthetic pointer events (brief §17, #10).

import { STEER_UNIT, SPEED_SCALE } from "../shared/constants.js";

// Cruise control: turn the lever's set-speed fraction (0..1 of maxSpeed) into
// accel/brake against the LIVE car speed, so the engine stays untouched. A
// deadband stops accel/brake chatter when the car is already at the set speed.
// Pure — unit-tested; main.js calls it each racing tick with the touch lever.
export function cruiseInput(speed, throttleFrac, maxSpeed) {
  const target = Math.round(throttleFrac * maxSpeed);
  const dead = SPEED_SCALE >> 2;
  if (speed < target - dead) return { accel: 1, brake: 0 };
  if (speed > target + dead) return { accel: 0, brake: 1 };
  return { accel: 0, brake: 0 };
}

// Edge-triggered fork arrows sit in the top corners.
export const BUTTONS = [
  { id: "forkL", x0: 0.02, x1: 0.16, y0: 0.03, y1: 0.15, label: "↰" },
  { id: "forkR", x0: 0.84, x1: 0.98, y0: 0.03, y1: 0.15, label: "↱" },
];

// Steering wheel: grab anywhere in this bottom-centre band, then drag left/right.
// Steer is the horizontal drag from the touch-down anchor, scaled so a full
// PAD_RANGE drag = full lock (±STEER_UNIT). Relative-to-anchor (not absolute) so
// the thumb never has to find a fixed centre — arcade wheels behave the same way.
export const STEER_WHEEL = { x0: 0.28, x1: 0.72, y0: 0.68, y1: 1.0 };
export const PAD_RANGE = 0.14; // fraction of canvas width dragged for full lock

// Throttle lever: a vertical slider on the right. Knob at the top = full speed,
// bottom = stopped. The value PERSISTS across releases (it is a set speed).
export const THROTTLE = { x0: 0.85, x1: 0.985, y0: 0.30, y1: 0.94 };

const active = new Map(); // pointerId -> held button id (fork taps only)
const steerState = { pointerId: null, anchorFx: 0, steer: 0 };
const throttleState = { pointerId: null, frac: 1 }; // default: full cruise
const forkQueue = [];

function inRect(r, fx, fy) {
  return fx >= r.x0 && fx < r.x1 && fy >= r.y0 && fy < r.y1;
}

function steerFromDrag(fx) {
  const raw = Math.round(((fx - steerState.anchorFx) / PAD_RANGE) * STEER_UNIT);
  return Math.max(-STEER_UNIT, Math.min(STEER_UNIT, raw));
}

// Map a fy inside the lever track to a 0..1 set-speed fraction (top = 1).
function throttleFromDrag(fy) {
  const t = (THROTTLE.y1 - fy) / (THROTTLE.y1 - THROTTLE.y0);
  return Math.max(0, Math.min(1, t));
}

function hitButton(fx, fy) {
  for (const b of BUTTONS) if (inRect(b, fx, fy)) return b;
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
    steerState.steer = 0; // wheel springs back to centre
  }
  if (throttleState.pointerId === pointerId) {
    throttleState.pointerId = null; // knob STAYS where it was left (set speed)
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
      return;
    }
    if (inRect(THROTTLE, fx, fy) && throttleState.pointerId === null) {
      if (e.preventDefault) e.preventDefault();
      throttleState.pointerId = e.pointerId;
      throttleState.frac = throttleFromDrag(fy);
      return;
    }
    if (inRect(STEER_WHEEL, fx, fy) && steerState.pointerId === null) {
      if (e.preventDefault) e.preventDefault();
      steerState.pointerId = e.pointerId;
      steerState.anchorFx = fx;
      steerState.steer = 0;
    }
  };
  const move = (e) => {
    const { fx, fy } = eventFraction(canvas, e);
    if (throttleState.pointerId === e.pointerId) {
      throttleState.frac = throttleFromDrag(fy);
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (steerState.pointerId === e.pointerId) {
      steerState.steer = steerFromDrag(fx);
      if (e.preventDefault) e.preventDefault();
    }
  };
  const up = (e) => releasePointer(e.pointerId);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", up);
}

// Reduce the wheel + lever to an input frame. `throttleFrac` is the SET SPEED as
// a 0..1 fraction of the car's max; main.js turns it into accel/brake.
export function readTouchInput() {
  return {
    steer: steerState.pointerId !== null ? steerState.steer : 0,
    throttleFrac: throttleState.frac,
  };
}

export function readTouchFork() {
  return forkQueue.length ? forkQueue.shift() : 0;
}

export function touchDetected() {
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in globalThis);
}

// Draw the control overlay (faint; brighter while touched).
export function drawTouchControls(g, view) {
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "20px monospace";

  // --- Steering wheel: a big rim centred below the bottom edge, only its top
  // arc visible; it rotates with the steer fraction. ---
  {
    const cx = view.w * 0.5;
    const cy = view.h * 1.24;          // centre below the screen
    const r = view.h * 0.5;            // top arc pokes up to ~0.74h
    const frac = steerState.pointerId !== null ? steerState.steer / STEER_UNIT : 0;
    const ang = frac * 0.6;            // ~34° full lock
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.globalAlpha = steerState.pointerId !== null ? 0.5 : 0.28;
    g.strokeStyle = "#ffffff";
    g.lineWidth = Math.max(6, view.h * 0.02);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    // three spokes + hub
    g.beginPath();
    for (const a of [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 3, -Math.PI / 2 - (2 * Math.PI) / 3]) {
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.stroke();
    g.globalAlpha = steerState.pointerId !== null ? 0.7 : 0.4;
    g.fillStyle = "#ffd060";
    g.beginPath();
    g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // --- Throttle lever: vertical track + knob at the set-speed fraction. ---
  {
    const x = THROTTLE.x0 * view.w;
    const y = THROTTLE.y0 * view.h;
    const w = (THROTTLE.x1 - THROTTLE.x0) * view.w;
    const h = (THROTTLE.y1 - THROTTLE.y0) * view.h;
    const held = throttleState.pointerId !== null;
    g.globalAlpha = 0.15;
    g.fillStyle = "#ffffff";
    g.fillRect(x, y, w, h);
    // filled portion below the knob shows the set level
    const knobY = y + (1 - throttleState.frac) * h;
    g.globalAlpha = 0.3;
    g.fillStyle = "#ffd060";
    g.fillRect(x, knobY, w, y + h - knobY);
    // knob
    g.globalAlpha = held ? 0.85 : 0.6;
    g.fillStyle = "#ffd060";
    g.fillRect(x - 3, knobY - 9, w + 6, 18);
    g.globalAlpha = 0.7;
    g.fillStyle = "#101018";
    g.fillText(String(Math.round(throttleState.frac * 100)), x + w / 2, knobY - 22);
    g.fillStyle = "#9a9ab0";
    g.font = "16px monospace";
    g.globalAlpha = 0.6;
    g.fillText("SPD", x + w / 2, y - 12);
    g.font = "20px monospace";
  }

  // --- Fork buttons. ---
  for (const b of BUTTONS) {
    const x = b.x0 * view.w;
    const y = b.y0 * view.h;
    const w = (b.x1 - b.x0) * view.w;
    const h = (b.y1 - b.y0) * view.h;
    g.globalAlpha = 0.2;
    g.fillStyle = "#ffffff";
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.globalAlpha = 0.9;
    g.fillStyle = "#101018";
    g.fillText(b.label, x + w / 2, y + h / 2);
  }
  g.restore();
}
