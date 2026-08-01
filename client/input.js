// client/input.js — keyboard → input frame (CLIENT ONLY).
// Maintains a held-key set and reduces it to the integer input command the
// reducer expects. Import-safe: listeners are only attached when installed.

const keys = new Set();
const forkQueue = []; // edge-triggered fork presses (-1 left / 1 right)

// Keys we drive with — both WASD and arrows. preventDefault stops the arrow keys
// (and space) from scrolling the page while driving.
const DRIVE_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space",
]);

export function installKeyboard(target) {
  target.addEventListener("keydown", (e) => {
    if (!keys.has(e.code)) {
      if (e.code === "KeyQ") forkQueue.push(-1);
      else if (e.code === "KeyE") forkQueue.push(1);
    }
    keys.add(e.code);
    if (DRIVE_KEYS.has(e.code) && e.preventDefault) e.preventDefault();
  });
  target.addEventListener("keyup", (e) => keys.delete(e.code));
}

// Pop the next queued fork press (0 if none) — discrete, not held.
export function readForkChoice() {
  return forkQueue.length ? forkQueue.shift() : 0;
}

// Reduce current keys to { steer, accel, brake } (all integers).
export function readInput() {
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const accel = keys.has("ArrowUp") || keys.has("KeyW");
  const brake = keys.has("ArrowDown") || keys.has("KeyS");
  return {
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    accel: accel ? 1 : 0,
    brake: brake ? 1 : 0,
  };
}
