// client/main.js — boot + fixed-step loop (CLIENT ONLY).
// 20 Hz authoritative sim (accumulator), render every animation frame.
// Import-safe: boot() only runs under a real DOM.

import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { TICK_HZ } from "../shared/constants.js";
import { createLocalSession } from "./session_local.js";
import { createRemoteSession } from "./session_remote.js";
import { installKeyboard, readInput, readForkChoice, readMenuNav } from "./input.js";
import { installTouch, readTouchInput, readTouchFork, drawTouchControls, touchDetected } from "./touch_controls.js";
import { render } from "./renderer_canvas.js";
import { createCelebration } from "./celebration.js";
import { computeBufferSize } from "./viewport.js";
import { installWakeLock } from "./wakelock.js";
import { drawConnectionBanner } from "./connection_banner.js";
import { carChoiceFromParams, createCarSelect, drawCarSelect, carSelectTouchZone } from "./car_select.js";
import { difficultyFromParams, createDifficultySelect, drawDifficultySelect, difficultyTouchZone } from "./difficulty_select.js";
import { createAudio } from "./audio.js";
import { loadScenery } from "./scenery.js";
import { readTuning, applyTuning, drawTuningHud } from "./tuning.js";
import { createCountdown, drawCountdownLabel } from "./countdown.js";
import { drawSplash } from "./splash.js";
import { buildSummary, playersFromState, drawRaceSummary, NEW_RACE_SECONDS, stageNumber, stageTotal } from "./race_summary.js";
import { getCourse, getSegment } from "../shared/road_data.js";
import { carColor } from "./car_colors.js";
import { createAnnouncer, stageLabel } from "./stage_announce.js";
import { nameFromParams, createNameEntry, rememberName } from "./name_entry.js";
import { playerId } from "./player_id.js";
import { drawTimeUpButtons, timeUpTouchZone, drawSpectateOverlay, spectateTouchZone, drawMiniScoreboard } from "./spectate.js";

const SIM_DT = 1000 / TICK_HZ;

export async function boot(doc = document) {
  const canvas = doc.getElementById("game");
  const g = canvas.getContext("2d");
  const view = { w: canvas.width, h: canvas.height };

  // Crisp on retina/mobile: match the drawing buffer to the displayed size × DPR.
  function fit() {
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.width, height: canvas.height };
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const { w, h } = computeBufferSize(rect.width, rect.height, dpr);
    canvas.width = w;
    canvas.height = h;
    view.w = w;
    view.h = h;
  }
  fit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
  }
  installWakeLock(); // keep the phone awake while driving

  // Splash + client-side asset loading bar. Each fetch bumps a counter; the
  // splash shows for at least MIN_SPLASH_MS so it doesn't just flash on fast
  // local loads, then we proceed once everything is in.
  const splashStart = performance.now();
  const MIN_SPLASH_MS = 1400;
  const TOTAL_ASSETS = 6;
  let loaded = 0;
  const grab = (path) => fetch(path).then((r) => r.json()).finally(() => { loaded++; });
  const dataPromise = Promise.all([
    grab("../data/roads.json"),
    grab("../data/cars.json"),
    grab("../data/checkpoints.json"),
    grab("../data/traffic.json"),
    grab("../data/assets.json"),
    grab("../data/scenery.json").catch(() => null),
  ]);
  await new Promise((resolve) => {
    function splashFrame() {
      const el = performance.now() - splashStart;
      drawSplash(g, view, Math.min(1, el / MIN_SPLASH_MS));
      if (el >= MIN_SPLASH_MS && loaded >= TOTAL_ASSETS) resolve();
      else requestAnimationFrame(splashFrame);
    }
    requestAnimationFrame(splashFrame);
  });
  const [roads, cars, checkpoints, traffic, assets, sceneryJson] = await dataPromise;
  const courseSet = loadCourseSet(roads);
  const carSet = loadCarSet(cars);
  const { startTimeTicks } = loadCheckpointConfig(checkpoints);
  const trafficConfig = loadTrafficConfig(traffic);
  const scenery = loadScenery(sceneryJson);

  // ?mode=remote joins the ws server room; default is an offline local race.
  // ?course=N selects the course for a local race (default 1).
  // ?car=N picks a car and skips the select overlay (else the overlay shows).
  const params = new URLSearchParams(location.search);
  const remote = params.get("mode") === "remote";
  const courseId = Number(params.get("course")) || 4; // grand_tour is the default
  // Live feel-tuning knobs (renderer-only): ?depth=/?height=/?hill=/?follow=/etc
  // override the camera/road constants; ?tune=1 shows the current values on screen.
  applyTuning(readTuning(params));
  const showTune = params.get("tune") === "1";

  installKeyboard(doc);
  installTouch(canvas);
  const showTouch = touchDetected() || params.get("touch") === "1";
  const celebration = createCelebration();

  // Procedural audio: engine hum + SFX + chiptune. Browsers block autoplay, so
  // it only spins up on the first user gesture. ?mute=1 disables it.
  const audio = createAudio({ enabled: params.get("mute") !== "1" });
  let audioArmed = false;
  const armAudio = () => { if (!audioArmed) { audioArmed = true; audio.resume(); } };
  doc.addEventListener?.("keydown", armAudio);
  canvas.addEventListener?.("pointerdown", armAudio);

  // Phases: "select" (car) -> "difficulty" -> "race". The session is not created
  // until both are chosen, so JOIN carries the car and the run uses the timeScale.
  // ?car=N / ?diff=level skip the respective picker. Difficulty is local-only for
  // now (remote is server-authoritative; first-player-selects is future work).
  const choice = carChoiceFromParams(params, carSet);
  const diffChoice = difficultyFromParams(params);
  const storage = (typeof localStorage !== "undefined") ? localStorage : null;
  const pid = playerId(storage); // stable score identity across re-joins
  const nameChoice = nameFromParams(params, storage);
  let playerName = nameChoice.name || "Player";
  const nameEntry = createNameEntry(nameChoice.name);
  const needName = remote && !nameChoice.name; // only prompt in multiplayer, once
  const sel = createCarSelect(carSet, choice.carId);
  const diffSel = createDifficultySelect(diffChoice.level);
  // Difficulty is picked in both modes now: locally it scales the session; in
  // remote the FIRST joiner's pick sets the room (specs/53).
  const showDifficulty = !diffChoice.fromUrl;
  let session = null;

  const countdown = createCountdown();
  const announcer = createAnnouncer();
  let prevSegmentId = null;
  let activeCarId = choice.carId;
  let activeTimeScale = diffChoice.timeScale;
  let activeDiffLevel = diffChoice.level;
  let raceSummary = null;
  let summaryStart = 0;
  let timeUpSel = 0;      // 0 = RE-JOIN, 1 = SPECTATE (multiplayer time-up)
  let spectateIndex = 0;  // which rival is being spectated
  let prevCrashed = 0, prevFinish = -1, prevTimer = NaN; // SFX edge trackers

  function start(carId, timeScale, diffLevel) {
    session = remote
      ? createRemoteSession(`ws://${location.host}`, { courseSet, carSet, startTimeTicks, carId, diff: diffLevel, name: playerName, pid })
      : createLocalSession(courseSet, carSet, { seed: 12345, courseId, startTimeTicks, trafficConfig, carId, timeScale });
    if (remote) session.connect();
    activeCarId = carId;
    activeTimeScale = timeScale;
    activeDiffLevel = diffLevel;
    prevCrashed = 0; prevFinish = -1; prevTimer = NaN;
    prevSegmentId = null;
    timeUpSel = 0; spectateIndex = 0;
    raceSummary = null;
    celebration.reset(); // clear finish confetti/splash from the previous race
    countdown.start(performance.now());
    phase = "race";
  }
  // After the car is chosen, go to difficulty or straight to the race.
  function afterCar() {
    if (showDifficulty) { phase = "difficulty"; }
    else start(sel.carId, diffChoice.timeScale, diffChoice.level);
  }

  // First real screen once any name is settled.
  function firstPhase() {
    return choice.fromUrl ? (showDifficulty ? "difficulty" : "race") : "select";
  }
  function afterName() {
    playerName = nameEntry.text.trim() || "Player";
    rememberName(storage, playerName);
    phase = firstPhase();
    if (phase === "race") start(choice.carId, diffChoice.timeScale, diffChoice.level);
  }
  // Type the name during the "name" phase (multiplayer, first time).
  doc.addEventListener?.("keydown", (e) => {
    if (phase !== "name") return;
    if (nameEntry.key(e.key) === "confirm") afterName();
  });

  let phase = needName ? "name" : firstPhase();
  if (phase === "race") start(choice.carId, diffChoice.timeScale, diffChoice.level);

  // Tap-to-choose on touch.
  canvas.addEventListener?.("pointerup", (e) => {
    const rect = canvas.getBoundingClientRect?.() || { left: 0, top: 0, width: view.w, height: view.h };
    const x = ((e.clientX - rect.left) / (rect.width || 1)) * view.w;
    const y = ((e.clientY - rect.top) / (rect.height || 1)) * view.h;
    if (phase === "select") {
      if (sel.handle(carSelectTouchZone(view, x, y)) === "confirm") afterCar();
    } else if (phase === "difficulty") {
      diffSel.setIndex(difficultyTouchZone(view, x)); // tap a button = pick it
      start(sel.carId, diffSel.timeScale, diffSel.level);
    } else if (phase === "summary" && remote) {
      timeUpSel = timeUpTouchZone(view, x);
      if (timeUpSel === 0) start(activeCarId, activeTimeScale, activeDiffLevel);
      else phase = "spectate";
    } else if (phase === "spectate") {
      const z = spectateTouchZone(view, x);
      if (z === "prev") spectateIndex--;
      else if (z === "next") spectateIndex++;
      else start(activeCarId, activeTimeScale, activeDiffLevel);
    }
  });

  let acc = 0;
  let last = performance.now();
  let frameCount = 0;
  function frame(now) {
    // Drain menu-nav events every frame so the queue never leaks; only the
    // select phase acts on them (arrow keys also steer during the race).
    let ev;
    while ((ev = readMenuNav()) !== null) {
      if (phase === "select" && sel.handle(ev) === "confirm") { afterCar(); break; }
      else if (phase === "difficulty" && diffSel.handle(ev) === "confirm") { start(sel.carId, diffSel.timeScale, diffSel.level); break; }
      else if (phase === "summary" && remote) {
        if (ev === "left") timeUpSel = 0;
        else if (ev === "right") timeUpSel = 1;
        else if (ev === "confirm") { if (timeUpSel === 0) start(activeCarId, activeTimeScale, activeDiffLevel); else phase = "spectate"; break; }
      } else if (phase === "spectate") {
        if (ev === "left") spectateIndex--;
        else if (ev === "right") spectateIndex++;
        else if (ev === "confirm") { start(activeCarId, activeTimeScale, activeDiffLevel); break; }
      }
    }
    if (phase === "name") {
      nameEntry.draw(g, view);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    if (phase === "select") {
      drawCarSelect(g, view, sel);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    if (phase === "difficulty") {
      drawDifficultySelect(g, view, diffSel);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    if (phase === "spectate") {
      const st = session.getState();
      const ghosts = st.ghosts || [];
      if (ghosts.length) {
        const idx = ((spectateIndex % ghosts.length) + ghosts.length) % ghosts.length;
        const t = ghosts[idx];
        const synthSelf = { carId: t.carId, segmentId: t.segmentId, roadZ: t.roadZ, laneX: t.laneX, speed: t.speed, finishTicks: -1, timerTicks: 0, crashedTicks: 0 };
        const others = ghosts.filter((_, i) => i !== idx);
        // Show your own (stopped) car among the rivals too.
        const me = st.seats[0];
        const meGhost = me ? { seatId: session.seatId, carId: me.carId, name: playerName, segmentId: me.segmentId, roadZ: me.roadZ, laneX: me.laneX, finishTicks: me.finishTicks, collisionActive: 0 } : null;
        const synthGhosts = meGhost ? [...others, meGhost] : others;
        const synthState = { tick: st.tick, seats: [synthSelf], ghosts: synthGhosts, traffic: st.traffic || [], hazards: st.hazards || [], events: [] };
        const sStart = getCourse(courseSet, courseId).startSegment;
        render(g, view, synthState, courseSet, assets, scenery, { stage: stageNumber(courseSet, sStart, t.segmentId), total: stageTotal(courseSet, courseId) });
        drawMiniScoreboard(g, view, session.scoreboard, session.seatId);
        drawSpectateOverlay(g, view, t.name || `P${t.seatId}`, idx, ghosts.length);
      } else {
        g.fillStyle = "#1a1030";
        g.fillRect(0, 0, view.w, view.h);
        g.textAlign = "center";
        g.fillStyle = "#ffffff";
        g.font = `${Math.round(view.h * 0.045)}px sans-serif`;
        g.fillText("NO ONE TO SPECTATE — ENTER to re-join", view.w / 2, view.h * 0.5);
        g.textAlign = "left";
      }
      if (remote) drawConnectionBanner(g, view, session.status, frameCount);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    const racing = phase === "race";
    if (racing) {
      const kb = readInput();
      const tc = readTouchInput();
      session.setInput({
        steer: kb.steer || tc.steer,
        accel: kb.accel || tc.accel,
        brake: kb.brake || tc.brake,
      });
      const fc = readForkChoice() || readTouchFork();
      if (fc !== 0) session.setForkChoice(fc);
    }
    // Local race freezes during the countdown (clock + car held at the line).
    const counting = racing && !remote && !countdown.isDone(now);
    if (racing && !remote && !counting) {
      acc += now - last;
      last = now;
      while (acc >= SIM_DT) {
        session.tick(); // local session owns advancement
        acc -= SIM_DT;
      }
    } else {
      last = now; // paused (countdown / summary): keep the accumulator fresh
    }
    const state = session.getState();
    const stageStart = getCourse(courseSet, courseId).startSegment;
    const hud = state.seats[0]
      ? { stage: stageNumber(courseSet, stageStart, state.seats[0].segmentId), total: stageTotal(courseSet, courseId), points: remote ? session.points : undefined }
      : {};
    if (state.seats.length) render(g, view, state, courseSet, assets, scenery, hud);
    // Stage-entry announcement: fire when the car enters a new segment — but hold
    // the FIRST one until the 3-2-1-GO countdown has finished (local or server),
    // so it doesn't collide with the GO text.
    const selfSeat = state.seats[0];
    const preRace = counting || (remote && session.countdown > 0);
    if (racing && !preRace && selfSeat && selfSeat.segmentId !== -1 && selfSeat.segmentId !== prevSegmentId) {
      announcer.announce(stageLabel(hud.stage, getSegment(courseSet, selfSeat.segmentId).nameKey), now);
      prevSegmentId = selfSeat.segmentId;
    }
    // Audio: engine pitch tracks speed; SFX fire on state edges (crash entered,
    // finish crossed, timer bumped up by a checkpoint).
    const self = state.seats[0];
    if (self) {
      audio.setSpeed(self.speed, sel.car.maxSpeed);
      if (self.crashedTicks > 0 && prevCrashed === 0) audio.event("crash");
      if (self.finishTicks >= 0 && prevFinish < 0) audio.event("finish");
      if (Number.isFinite(prevTimer) && self.timerTicks > prevTimer) audio.event("checkpoint");
      prevCrashed = self.crashedTicks || 0;
      prevFinish = self.finishTicks ?? -1;
      prevTimer = self.timerTicks;
    }
    // Finish splash: confetti + fireworks once the local car crosses the line.
    if (self && self.finishTicks >= 0) celebration.trigger(view);
    celebration.update(view);
    celebration.draw(g, view);
    if (showTouch) drawTouchControls(g, view);
    if (showTune) drawTuningHud(g, view);
    if (counting) countdown.draw(g, view, now);
    // Remote: the server owns the shared pre-race countdown (specs/53).
    if (remote && racing && session.countdown > 0) drawCountdownLabel(g, view, String(session.countdown));
    announcer.draw(g, view, now);
    if (remote) drawConnectionBanner(g, view, session.status, frameCount);

    // Race end -> summary of the field + a 30 s countdown to a fresh race.
    if (racing && self && (self.finishTicks >= 0 || self.timedOut)) {
      // Multiplayer ranks by the server scoreboard (points); solo by stage reached.
      const sb = remote ? session.scoreboard : [];
      raceSummary = sb.length
        ? sb.map((e, i) => ({ rank: i + 1, name: e.name, color: carColor(e.carId), points: e.points, isYou: e.seatId === session.seatId, finished: false }))
        : buildSummary(courseSet, courseId, carSet, playersFromState(state));
      summaryStart = now;
      phase = "summary";
    }
    if (phase === "summary") {
      if (remote) {
        // Multiplayer: RE-JOIN / SPECTATE instead of an auto-restart.
        drawRaceSummary(g, view, raceSummary, -1);
        drawTimeUpButtons(g, view, timeUpSel);
      } else {
        const secs = NEW_RACE_SECONDS - Math.floor((now - summaryStart) / 1000);
        drawRaceSummary(g, view, raceSummary, secs);
        if (secs <= 0) start(activeCarId, activeTimeScale, activeDiffLevel); // fresh race, same car/difficulty
      }
    }
    frameCount++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
