// client/projection.js — pseudo-3D projection helpers (CLIENT ONLY).
// Floats live here on purpose: projection is presentation, not part of the
// deterministic contract (specs/01 §21.3), so it stays OUT of shared/engine.
// Pure and node-testable — no DOM. Standard pseudo-3D projection. See specs/04.

// Camera/road tuning. Magnitudes are a first pass; visual feel needs a native
// browser tuning session (brief §17), which this headless slice cannot do.
export const CAMERA = {
  depth: 0.84,       // 1 / tan(fov/2)
  height: 1500,      // camera height above the road, world units
  roadWidth: 2000,   // road half-width in world units
  near: 1,           // clamp so a strip never divides by ~0
};

// Project a world point to the screen. `view` = { w, h } canvas px.
// camX/camZ are the camera's lateral/forward world position; the camera sits
// CAMERA.height above the road. Returns integer screen coords + the road half-
// width in px and the raw scale (useful for sprite sizing).
export function projectPoint(view, camX, camZ, worldX, worldY, worldZ) {
  const dz = Math.max(worldZ - camZ, CAMERA.near);
  const scale = CAMERA.depth / dz;
  const x = Math.round(view.w / 2 + scale * (worldX - camX) * (view.w / 2));
  const y = Math.round(view.h / 2 - scale * (worldY - -CAMERA.height) * (view.h / 2));
  const w = Math.round(scale * CAMERA.roadWidth * (view.w / 2));
  return { x, y, w, scale };
}
