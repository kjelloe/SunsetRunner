// client/car_select.js — pre-race car picker (CLIENT ONLY).
// Pure cursor logic + a fake-ctx-safe draw. The roster (data/cars.json) is real;
// this is the UI that lets a human choose which car to JOIN with (marker-0041).

import { carColor } from "./car_colors.js";

// Turn "car.red_sprint" into "Red Sprint" for display.
export function carDisplayName(nameKey) {
  return String(nameKey)
    .replace(/^car\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// ?car=N picks a car up front (parity with ?course=N) and skips the overlay.
// Invalid / absent → the first car, and the overlay is shown.
export function carChoiceFromParams(params, carSet) {
  const raw = Number(params.get("car"));
  if (Number.isInteger(raw) && carSet.cars.some((c) => c.id === raw)) {
    return { carId: raw, fromUrl: true };
  }
  return { carId: carSet.cars[0].id, fromUrl: false };
}

export function createCarSelect(carSet, initialCarId) {
  const cars = carSet.cars;
  let index = cars.findIndex((c) => c.id === initialCarId);
  if (index < 0) index = 0;
  return {
    get index() { return index; },
    get carId() { return cars[index].id; },
    get car() { return cars[index]; },
    count: cars.length,
    left() { index = (index - 1 + cars.length) % cars.length; return cars[index].id; },
    right() { index = (index + 1) % cars.length; return cars[index].id; },
    // Apply a menu event ("left"/"right"/"confirm"); returns "confirm" when the
    // current car is chosen, else null.
    handle(ev) {
      if (ev === "left") { this.left(); return null; }
      if (ev === "right") { this.right(); return null; }
      if (ev === "confirm") return "confirm";
      return null;
    },
  };
}

// Map a canvas tap to a select action: left third = prev, right third = next,
// centre = confirm. Pure so it is unit-testable.
export function carSelectTouchZone(view, x, y) {
  const third = view.w / 3;
  if (x < third) return "left";
  if (x > third * 2) return "right";
  return "confirm";
}

// Stat → bar fraction (0..1) against a fixed reference max, so bars are
// comparable across cars regardless of the current roster's spread.
const STAT_MAX = { maxSpeed: 2800, accel: 30, brake: 60, steerLow: 28 };
const STAT_ROWS = [
  ["SPEED", "maxSpeed"],
  ["ACCEL", "accel"],
  ["BRAKE", "brake"],
  ["GRIP", "steerLow"],
];

// A simple side-profile car silhouette in `color`, centred at (cx, cy).
function drawCarProfile(g, cx, cy, w, color) {
  const h = w * 0.42;
  const x = cx - w / 2;
  const top = cy - h / 2;
  g.fillStyle = "rgba(0,0,0,0.35)"; // shadow
  g.beginPath();
  g.ellipse(cx, top + h * 1.02, w * 0.5, h * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color; // lower body
  g.fillRect(x, top + h * 0.45, w, h * 0.35);
  g.beginPath(); // cabin
  g.moveTo(x + w * 0.26, top + h * 0.5);
  g.lineTo(x + w * 0.38, top + h * 0.12);
  g.lineTo(x + w * 0.66, top + h * 0.12);
  g.lineTo(x + w * 0.74, top + h * 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(180,220,255,0.85)"; // windows
  g.beginPath();
  g.moveTo(x + w * 0.34, top + h * 0.46);
  g.lineTo(x + w * 0.42, top + h * 0.2);
  g.lineTo(x + w * 0.62, top + h * 0.2);
  g.lineTo(x + w * 0.68, top + h * 0.46);
  g.closePath();
  g.fill();
  g.fillStyle = "#fff3b0"; // headlight
  g.fillRect(x + w * 0.92, top + h * 0.5, w * 0.06, h * 0.12);
  for (const wx of [0.24, 0.76]) { // wheels
    g.fillStyle = "#141414";
    g.beginPath();
    g.arc(x + w * wx, top + h * 0.82, h * 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#555";
    g.beginPath();
    g.arc(x + w * wx, top + h * 0.82, h * 0.1, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawCarSelect(g, view, sel) {
  const car = sel.car;
  g.fillStyle = "#1a1030";
  g.fillRect(0, 0, view.w, view.h);

  g.fillStyle = "#ffd54a";
  g.textAlign = "center";
  g.font = `${Math.round(view.h * 0.06)}px sans-serif`;
  g.fillText("CHOOSE YOUR CAR", view.w / 2, view.h * 0.18);

  g.fillStyle = carColor(car.id); // name in the car's identity colour
  g.font = `${Math.round(view.h * 0.08)}px sans-serif`;
  g.fillText(carDisplayName(car.nameKey), view.w / 2, view.h * 0.33);

  g.font = `${Math.round(view.h * 0.05)}px sans-serif`;
  g.fillText("◄", view.w * 0.12, view.h * 0.4); // left arrow
  g.fillText("►", view.w * 0.88, view.h * 0.4); // right arrow

  // Side-profile picture of the car, in its identity colour.
  drawCarProfile(g, view.w / 2, view.h * 0.44, view.w * 0.34, carColor(car.id));
  g.textAlign = "center";
  g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
  g.fillStyle = "#cfe";
  g.fillText(`${sel.index + 1} / ${sel.count}`, view.w / 2, view.h * 0.55);

  // Stat bars.
  const barX = view.w * 0.30;
  const barW = view.w * 0.40;
  const barH = view.h * 0.035;
  g.textAlign = "right";
  g.font = `${Math.round(view.h * 0.035)}px sans-serif`;
  STAT_ROWS.forEach(([label, key], i) => {
    const y = view.h * 0.6 + i * view.h * 0.07;
    g.fillStyle = "#8fa";
    g.fillText(label, barX - view.w * 0.02, y + barH);
    g.fillStyle = "#332a55";
    g.fillRect(barX, y, barW, barH);
    const frac = Math.max(0, Math.min(1, car[key] / STAT_MAX[key]));
    g.fillStyle = "#ff7a3c";
    g.fillRect(barX, y, barW * frac, barH);
  });

  g.textAlign = "center";
  g.fillStyle = "#ffd54a";
  g.font = `${Math.round(view.h * 0.045)}px sans-serif`;
  g.fillText("◄ ►  choose    ENTER / tap  start", view.w / 2, view.h * 0.92);
  g.textAlign = "left";
}
