// client/road_renderer.js — build + draw the pseudo-3D road (CLIENT ONLY).
// forwardStrips() is a pure function of course geometry (node-testable); drawRoad
// touches the 2D context. Gameplay lives in the engine; this only presents it.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment, nextSegment } from "../shared/road_data.js";
import { projectPoint } from "./projection.js";

// Walk `count` strips (one ROAD_UNIT each) forward from the camera, crossing
// segment boundaries, accumulating integer curve/hill from the profiles.
// Pure — no DOM, no engine mutation.
export function forwardStrips(courseSet, segmentId, roadZ, count) {
  const out = [];
  if (segmentId === -1) return out;
  let segId = segmentId;
  let seg = getSegment(courseSet, segId);
  let stripIdx = Math.floor(roadZ / ROAD_UNIT);
  let curveX = 0;
  let curveDx = 0;
  for (let k = 0; k < count; k++) {
    if (stripIdx >= seg.stripCount) {
      const nxt = nextSegment(courseSet, segId, 0);
      if (nxt === -1) break;
      segId = nxt;
      seg = getSegment(courseSet, segId);
      stripIdx = 0;
    }
    const cm = seg.curveProfile.length;
    const hm = seg.hillProfile.length;
    const curve = seg.curveProfile[Math.floor((stripIdx * cm) / seg.stripCount)] || 0;
    const hill = seg.hillProfile[Math.floor((stripIdx * hm) / seg.stripCount)] || 0;
    curveDx += curve;
    curveX += curveDx;
    out.push({ k, worldZ: (k + 1) * ROAD_UNIT, curveX, hillY: hill * 40 });
    stripIdx++;
  }
  return out;
}

const DRAW_STRIPS = 200;

export function drawRoad(g, view, seat, courseSet) {
  const strips = forwardStrips(courseSet, seat.segmentId, seat.roadZ, DRAW_STRIPS);
  const camX = seat.laneX;

  // Back to front so nearer bands overpaint farther ones.
  for (let i = strips.length - 1; i >= 0; i--) {
    const s = strips[i];
    const p = projectPoint(view, camX, 0, s.curveX, s.hillY, s.worldZ);
    const prev = strips[i + 1]
      ? projectPoint(view, camX, 0, strips[i + 1].curveX, strips[i + 1].hillY, strips[i + 1].worldZ)
      : p;
    const top = Math.min(p.y, prev.y);
    const bottom = Math.max(p.y, prev.y) + 1;
    const band = Math.floor(s.worldZ / ROAD_UNIT) % 2 === 0;

    // grass
    g.fillStyle = band ? "#1f7a2e" : "#1a6b28";
    g.fillRect(0, top, view.w, bottom - top);
    // road
    g.fillStyle = band ? "#4a4a4a" : "#454545";
    g.fillRect(p.x - p.w, top, p.w * 2, bottom - top);
    // lane edge lines
    g.fillStyle = band ? "#e8e8e8" : "#c0c0c0";
    g.fillRect(p.x - p.w, top, Math.max(1, Math.floor(p.w * 0.04)), bottom - top);
    g.fillRect(p.x + p.w - Math.max(1, Math.floor(p.w * 0.04)), top, Math.max(1, Math.floor(p.w * 0.04)), bottom - top);
  }
}
