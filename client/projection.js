// client/projection.js — pseudo-3D projection helpers (CLIENT ONLY).
// Floats live here on purpose: projection is presentation, not part of the
// deterministic contract (specs/01 §21.3), so it stays OUT of shared/engine.
// Pure and node-testable — no DOM. Standard pseudo-3D projection. See specs/04.

import { TUNING } from "./tuning.js";

const NEAR = 1; // clamp so a strip never divides by ~0 (not a feel knob)

// Project a world point to the screen. `view` = { w, h } canvas px.
// camX/camZ are the camera's lateral/forward world position; the camera sits
// TUNING.camHeight above the road. Returns integer screen coords + the road
// half-width in px and the raw scale (useful for sprite sizing). Reads the live
// TUNING object each call so ?tune knobs take effect without a signature change.
export function projectPoint(view, camX, camZ, worldX, worldY, worldZ) {
  const dz = Math.max(worldZ - camZ, NEAR);
  const scale = TUNING.camDepth / dz;
  const x = Math.round(view.w / 2 + scale * (worldX - camX) * (view.w / 2));
  // Camera sits camHeight ABOVE the road, so a road point (worldY≈0) is BELOW
  // the camera: camera-relative Y = worldY - camHeight (negative), which lands
  // the road below the horizon (y > h/2). The old `- -height` form flipped this
  // and drew the road up in the sky. See specs/20.
  const y = Math.round(view.h / 2 - scale * (worldY - TUNING.camHeight) * (view.h / 2));
  const w = Math.round(scale * TUNING.roadWidth * (view.w / 2));
  return { x, y, w, scale };
}
