// client/race_summary.js — end-of-race summary + restart countdown (CLIENT ONLY).
// When the race ends (you finish or time out), rank every player by how far they
// got (finishers first, then by stage/road progress) and count down 30 s to a
// fresh race. Pure ranking logic is node-testable.

import { getCourse, getSegment } from "../shared/road_data.js";
import { carDisplayName } from "./car_select.js";
import { carColor } from "./car_colors.js";

export const NEW_RACE_SECONDS = 30;

// 1-based stage = BFS hop distance from the course start to `segmentId`
// (handles forks). -1 for a finished/invalid segment.
export function stageNumber(courseSet, startSegment, segmentId) {
  if (segmentId < 0) return -1;
  const dist = new Map([[startSegment, 1]]);
  const q = [startSegment];
  while (q.length) {
    const id = q.shift();
    if (id === segmentId) return dist.get(id);
    const seg = getSegment(courseSet, id);
    for (const e of [seg.next, seg.forkLeft, seg.forkRight]) {
      if (e > 0 && !dist.has(e)) { dist.set(e, dist.get(id) + 1); q.push(e); }
    }
  }
  return dist.get(segmentId) ?? -1;
}

// Rank the field. `players` = [{ carId, segmentId, roadZ, finishTicks, isYou }].
// Finishers first (earliest finishTick), then non-finishers by stage then roadZ.
export function buildSummary(courseSet, courseId, carSet, players) {
  const start = getCourse(courseSet, courseId).startSegment;
  const rows = players.map((p) => {
    const finished = p.finishTicks >= 0;
    const stage = finished ? -1 : stageNumber(courseSet, start, p.segmentId);
    const car = carSet.cars.find((c) => c.id === p.carId);
    return {
      name: car ? carDisplayName(car.nameKey) : `Car ${p.carId}`,
      color: carColor(p.carId),
      finished,
      finishTicks: p.finishTicks,
      stage,
      roadZ: p.roadZ || 0,
      isYou: !!p.isYou,
    };
  });
  rows.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTicks - b.finishTicks;
    if (a.stage !== b.stage) return b.stage - a.stage;
    return b.roadZ - a.roadZ;
  });
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// Gather the field from client state (self seat + ghosts) for buildSummary.
export function playersFromState(state) {
  const self = state.seats[0];
  const players = [{ carId: self.carId, segmentId: self.segmentId, roadZ: self.roadZ, finishTicks: self.finishTicks, isYou: true }];
  for (const gh of state.ghosts || []) {
    players.push({ carId: gh.carId, segmentId: gh.segmentId, roadZ: gh.roadZ, finishTicks: gh.finishTicks, isYou: false });
  }
  return players;
}

export function drawRaceSummary(g, view, rows, secondsToNewRace) {
  g.fillStyle = "rgba(8,6,20,0.85)";
  g.fillRect(0, 0, view.w, view.h);

  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ffd54a";
  g.font = `bold ${Math.round(view.h * 0.08)}px sans-serif`;
  g.fillText("RACE OVER", view.w / 2, view.h * 0.16);

  const rowH = view.h * 0.075;
  const top = view.h * 0.26;
  g.font = `${Math.round(view.h * 0.04)}px sans-serif`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const result = r.finished ? "FINISHED" : (r.stage > 0 ? `STAGE ${r.stage}` : "DNS");
    g.textAlign = "left";
    g.fillStyle = r.color;
    g.fillText(`${r.rank}.`, view.w * 0.22, y);
    g.fillStyle = r.isYou ? "#ffffff" : "#cfd0e0";
    g.fillText(r.isYou ? `${r.name} (you)` : r.name, view.w * 0.28, y);
    g.textAlign = "right";
    g.fillStyle = r.finished ? "#4ce05a" : "#cfd0e0";
    g.fillText(result, view.w * 0.78, y);
  });

  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.font = `${Math.round(view.h * 0.05)}px sans-serif`;
  g.fillText(`NEW RACE IN ${Math.max(0, secondsToNewRace)}s`, view.w / 2, view.h * 0.9);
  g.textAlign = "left";
}
