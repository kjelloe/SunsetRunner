// client/road_renderer.js — build + draw the pseudo-3D road (CLIENT ONLY).
// forwardStrips() is pure (node-testable); drawRoad touches the 2D context.
// The road SCROLLS: each strip's forward distance folds in the car's sub-strip
// position (roadZ % ROAD_UNIT), and a running worldStrip index gives the band /
// rumble / lane-dash phase — so bands flow toward the camera with speed.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment, nextSegment } from "../shared/road_data.js";
import { projectPoint } from "./projection.js";
import { DEFAULT_THEME } from "./scenery.js";

const HILL_SCALE = 180; // world-units of elevation per hillProfile step (visible crests/dips)

export function forwardStrips(courseSet, segmentId, roadZ, count) {
  const out = [];
  if (segmentId === -1) return out;
  let segId = segmentId;
  let seg = getSegment(courseSet, segId);
  let stripIdx = Math.floor(roadZ / ROAD_UNIT);
  const frac = roadZ - stripIdx * ROAD_UNIT; // position within the current strip
  let worldStrip = stripIdx;                 // absolute-ish strip index (scrolls)
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
    // Sub-strip offset (ROAD_UNIT - frac) makes the nearest strip slide toward
    // the camera as the car advances -> the road scrolls smoothly. hillProfile is
    // direct elevation (rises to a crest and back); HILL_SCALE makes it read.
    out.push({ k, worldStrip, worldZ: k * ROAD_UNIT + (ROAD_UNIT - frac), curveX, hillY: hill * HILL_SCALE });
    worldStrip++;
    stripIdx++;
  }
  return out;
}

const DRAW_STRIPS = 220;

export function drawRoad(g, view, seat, courseSet, camX = 0, theme = DEFAULT_THEME) {
  const strips = forwardStrips(courseSet, seat.segmentId, seat.roadZ, DRAW_STRIPS);

  for (let i = strips.length - 1; i >= 0; i--) {
    const s = strips[i];
    const p = projectPoint(view, camX, 0, s.curveX, s.hillY, s.worldZ);
    const prev = strips[i + 1]
      ? projectPoint(view, camX, 0, strips[i + 1].curveX, strips[i + 1].hillY, strips[i + 1].worldZ)
      : p;
    const top = Math.min(p.y, prev.y);
    const bh = Math.max(p.y, prev.y) - top + 1;
    const band = s.worldStrip % 2 === 0;

    // grass/ground (two scrolling shades, whole width) — themed per leg
    g.fillStyle = band ? theme.grassA : theme.grassB;
    g.fillRect(0, top, view.w, bh);

    // rumble: a themed/white band wider than the road, then the road on top
    const rw = Math.max(2, p.w * 0.18);
    g.fillStyle = band ? theme.rumbleA : "#f4f4f4";
    g.fillRect(p.x - p.w - rw, top, p.w * 2 + rw * 2, bh);

    // road
    g.fillStyle = band ? "#5a5a62" : "#53535b";
    g.fillRect(p.x - p.w, top, p.w * 2, bh);

    // dashed centre line (dash every 8 strips)
    if (s.worldStrip % 8 < 4) {
      const dw = Math.max(1, p.w * 0.045);
      g.fillStyle = "#f2e24a";
      g.fillRect(p.x - dw, top, dw * 2, bh);
    }
  }
}
