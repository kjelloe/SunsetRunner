// client/road_renderer.js — build + draw the pseudo-3D road (CLIENT ONLY).
// forwardStrips() is pure (node-testable); drawRoad touches the 2D context.
// The road SCROLLS: each strip's forward distance folds in the car's sub-strip
// position (roadZ % ROAD_UNIT), and a running worldStrip index gives the band /
// rumble / lane-dash phase — so bands flow toward the camera with speed.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment, nextSegment } from "../shared/road_data.js";
import { projectPoint } from "./projection.js";
import { DEFAULT_THEME } from "./scenery.js";
import { TUNING } from "./tuning.js";

const isFork = (seg) => seg.forkLeft >= 0 || seg.forkRight >= 0;
// Lateral divergence added per strip once past a fork's split — opens a visible
// grass median between the two branch roads.
const SPLIT_SEP_PER_STRIP = 26;

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

  // Right-branch path, activated once the drawn road passes a fork's split, so the
  // fork is VISIBLE: the road widens and splits into a left and a right curve.
  let rSeg = null;
  let rStripIdx = 0;
  let rCurveX = 0;
  let rCurveDx = 0;
  let sep = 0;

  for (let k = 0; k < count; k++) {
    if (stripIdx >= seg.stripCount) {
      if (isFork(seg) && !rSeg) {
        // Split: the main path follows the left branch; start the right branch.
        rSeg = getSegment(courseSet, seg.forkRight);
        rStripIdx = 0;
        rCurveX = curveX;
        rCurveDx = curveDx;
        sep = 0;
        segId = seg.forkLeft;
        seg = getSegment(courseSet, segId);
        stripIdx = 0;
      } else {
        const nxt = nextSegment(courseSet, segId, 0);
        if (nxt === -1) break;
        segId = nxt;
        seg = getSegment(courseSet, segId);
        stripIdx = 0;
      }
    }
    const cm = seg.curveProfile.length;
    const hm = seg.hillProfile.length;
    const curve = seg.curveProfile[Math.floor((stripIdx * cm) / seg.stripCount)] || 0;
    const hill = seg.hillProfile[Math.floor((stripIdx * hm) / seg.stripCount)] || 0;
    curveDx += curve;
    curveX += curveDx;
    const strip = { k, worldStrip, worldZ: k * ROAD_UNIT + (ROAD_UNIT - frac), curveX, hillY: hill * TUNING.hillScale };
    if (rSeg) {
      const rIdx = Math.min(rStripIdx, rSeg.stripCount - 1);
      const rc = rSeg.curveProfile[Math.floor((rIdx * rSeg.curveProfile.length) / rSeg.stripCount)] || 0;
      rCurveDx += rc;
      rCurveX += rCurveDx;
      sep += SPLIT_SEP_PER_STRIP;
      strip.forkLeftCurveX = curveX - sep;   // main road pulled left
      strip.forkRightCurveX = rCurveX + sep; // right branch pulled right
      strip.forkSep = sep;
      rStripIdx++;
    }
    out.push(strip);
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

    // Side terrain: a different ground on one/both sides of the road (e.g. sea on
    // a beach, ponds on a lake). Painted over the grass; the road covers the mid.
    if (theme.sideLeft) { g.fillStyle = theme.sideLeft; g.fillRect(0, top, p.x, bh); }
    if (theme.sideRight) { g.fillStyle = theme.sideRight; g.fillRect(p.x, top, view.w - p.x, bh); }

    // Draw one road ribbon centred at world-x `cx` (rumble + tarmac + sheen +
    // dash). Only the x shifts per branch — y/half-width are the same at a strip.
    const rw = Math.max(2, p.w * 0.18);
    const ribbon = (cx) => {
      const px = projectPoint(view, camX, 0, cx, s.hillY, s.worldZ).x;
      g.fillStyle = band ? theme.rumbleA : "#f4f4f4";
      g.fillRect(px - p.w - rw, top, p.w * 2 + rw * 2, bh);
      g.fillStyle = band ? "#5a5a62" : "#53535b";
      g.fillRect(px - p.w, top, p.w * 2, bh);
      if (theme.sheen && band) {
        g.fillStyle = `rgba(220,235,255,${theme.sheen})`;
        g.fillRect(px - p.w * 0.45, top, p.w * 0.9, bh);
      }
      if (s.worldStrip % 8 < 4) {
        const dw = Math.max(1, p.w * 0.045);
        g.fillStyle = "#f2e24a";
        g.fillRect(px - dw, top, dw * 2, bh);
      }
    };

    // Past a fork split, draw BOTH branch roads (grass median shows between them);
    // otherwise the single road.
    if (s.forkLeftCurveX != null) {
      ribbon(s.forkLeftCurveX);
      ribbon(s.forkRightCurveX);
    } else {
      ribbon(s.curveX);
    }
  }
}
