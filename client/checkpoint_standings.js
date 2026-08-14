// client/checkpoint_standings.js — the "who's through this checkpoint" board
// (CLIENT ONLY, presentation). When the local player crosses a checkpoint, a
// large numbered list of everyone who has reached it shows for ~5 s (then fades),
// each racer tagged with how many seconds behind the leader they arrived.
//
// Arrival time is the wall-clock moment we first OBSERVE a racer in the checkpoint
// segment. Segments are hundreds of road-units long, so at 60 fps every racer is
// seen inside the checkpoint segment on at least one frame — no crossing is
// missed. Pure of any engine state; keyed by the client's own clock so the gap is
// real elapsed time between arrivals.

import { getSegment } from "../shared/road_data.js";
import { carColor } from "./car_colors.js";

const SHOW_MS = 5000; // total time the board is up
const FADE_MS = 1000; // trailing fade so it clears for the race again

export function createCheckpointStandings(courseSet) {
  const arrivals = new Map(); // checkpointSegId -> Map(racerId -> { t, name, carId })
  let selfLastCp = -1;
  let primed = false; // suppress the board for the checkpoint we START/JOIN inside
  let board = null; // { segId, at, entries }

  function isCheckpoint(segId) {
    if (segId == null || segId < 0) return false;
    const s = getSegment(courseSet, segId);
    return !!s && s.checkpointTicks > 0;
  }

  function record(racer, now) {
    if (!isCheckpoint(racer.segmentId)) return false;
    let m = arrivals.get(racer.segmentId);
    if (!m) { m = new Map(); arrivals.set(racer.segmentId, m); }
    if (m.has(racer.id)) return false; // first observation only
    m.set(racer.id, { t: now, name: racer.name, carId: racer.carId });
    return true;
  }

  function buildBoard(segId, now) {
    const m = arrivals.get(segId);
    const rows = [...m.values()].sort((a, b) => a.t - b.t);
    const t0 = rows.length ? rows[0].t : now;
    return {
      segId, at: now,
      entries: rows.map((e, i) => ({ rank: i + 1, name: e.name, carId: e.carId, gap: (e.t - t0) / 1000 })),
    };
  }

  // racers: [{ id, name, carId, segmentId, isSelf }]. Fires the board when SELF
  // reaches a checkpoint not yet shown.
  function update(now, racers) {
    // On the first frame, mark the segment we START in as already-shown so no board
    // pops the instant the race begins inside a checkpoint segment (a stage-1 board
    // makes no sense — nobody has raced yet).
    if (!primed) {
      primed = true;
      const self = racers.find((r) => r.isSelf);
      if (self) selfLastCp = self.segmentId;
    }
    let selfCrossed = null;
    for (const r of racers) {
      const isNew = record(r, now);
      if (isNew && r.isSelf) selfCrossed = r.segmentId;
    }
    if (selfCrossed != null && selfCrossed !== selfLastCp) {
      selfLastCp = selfCrossed;
      board = buildBoard(selfCrossed, now);
    }
  }

  // The board to draw right now, with its fade alpha, or null once expired.
  function active(now) {
    if (!board) return null;
    const el = now - board.at;
    if (el >= SHOW_MS) return null;
    const alpha = el > SHOW_MS - FADE_MS ? Math.max(0, (SHOW_MS - el) / FADE_MS) : 1;
    return { entries: board.entries, alpha };
  }

  return { update, active, buildBoard };
}

// Draw the board centred, at 2.5x the normal standings font, fading with `alpha`.
export function drawCheckpointStandings(g, view, boardState) {
  const { entries, alpha } = boardState;
  if (!entries.length) return;
  const base = view.h * 0.03;      // the normal HUD standings size
  const fs = Math.round(base * 2.5); // 2.5x larger, per the playtest note
  const x = view.w * 0.5;
  const top = view.h * 0.2;
  g.save();
  g.globalAlpha = alpha;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `bold ${Math.round(fs * 1.1)}px sans-serif`;
  g.fillStyle = "#ffd54a";
  g.fillText("CHECKPOINT", x, top);
  g.font = `bold ${fs}px sans-serif`;
  entries.forEach((e, i) => {
    const y = top + (i + 1) * fs * 1.25;
    const gap = e.rank === 1 ? "LEADER" : `+${e.gap.toFixed(1)}s`;
    g.fillStyle = carColor(e.carId);
    g.fillText(`${e.rank}. ${e.name}   ${gap}`, x, y);
  });
  g.restore();
}
