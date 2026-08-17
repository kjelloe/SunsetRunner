// client/main.js — boot + fixed-step loop (CLIENT ONLY).
// 20 Hz authoritative sim (accumulator), render every animation frame.
// Import-safe: boot() only runs under a real DOM.

import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { TICK_HZ, SPEED_SCALE } from "../shared/constants.js";
import { createLocalSession } from "./session_local.js";
import { createRemoteSession } from "./session_remote.js";
import { installKeyboard, readInput, readForkChoice, readMenuNav, readMusicCycle } from "./input.js";
import { installTouch, readTouchInput, readTouchFork, drawTouchControls, touchDetected } from "./touch_controls.js";
import { render } from "./renderer_canvas.js";
import { createCelebration } from "./celebration.js";
import { createCrashFeel } from "./crash_feel.js";
import { createNearMiss } from "./near_miss.js";
import { computeBufferSize } from "./viewport.js";
import { installWakeLock } from "./wakelock.js";
import { drawConnectionBanner, rejoinButtonHit } from "./connection_banner.js";
import { carChoiceFromParams, createCarSelect, drawCarSelect, carSelectTouchZone } from "./car_select.js";
import { difficultyFromParams, createDifficultySelect, drawDifficultySelect, difficultyTouchZone } from "./difficulty_select.js";
import { createAudio } from "./audio.js";
import { loadScenery } from "./scenery.js";
import { readTuning, applyTuning, drawTuningHud } from "./tuning.js";
import { createCountdown, drawCountdownLabel } from "./countdown.js";
import { drawSplash } from "./splash.js";
import { buildSummary, playersFromState, drawRaceSummary, drawLeaderboard, NEW_RACE_SECONDS, stageNumber, stageTotal } from "./race_summary.js";
import { recordScore, topScores } from "./local_scores.js";
import { isBetter } from "../shared/leaderboard.js";
import { createInitialsEntry } from "./initials_entry.js";
import { drawLobby, lobbyTouchZone, inviteUrl } from "./lobby.js";
import { getCourse, getSegment } from "../shared/road_data.js";
import { carColor } from "./car_colors.js";
import { createAnnouncer, stageLabel } from "./stage_announce.js";
import { createCheckpointStandings, drawCheckpointStandings } from "./checkpoint_standings.js";
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
  const aiCount = remote ? 0 : (params.has("ai") ? Math.max(0, Number(params.get("ai")) || 0) : 5); // solo AI rivals
  // Live feel-tuning knobs (renderer-only): ?depth=/?height=/?hill=/?follow=/etc
  // override the camera/road constants; ?tune=1 shows the current values on screen.
  applyTuning(readTuning(params));
  const showTune = params.get("tune") === "1";

  installKeyboard(doc);
  installTouch(canvas);
  const showTouch = touchDetected() || params.get("touch") === "1";
  const celebration = createCelebration();
  const crashFeel = createCrashFeel();
  const nearMiss = createNearMiss();

  // Procedural audio: engine hum + SFX + chiptune. Browsers block autoplay, so
  // it only spins up on the first user gesture. ?mute=1 disables it. The music
  // track (M to cycle) persists in localStorage; ?track=N overrides.
  const MUSIC_KEY = "sunset.music.track";
  const initTrack = Number(
    params.get("track") ?? (typeof localStorage !== "undefined" ? localStorage.getItem(MUSIC_KEY) : null) ?? 0,
  ) || 0;
  const audio = createAudio({ enabled: params.get("mute") !== "1", track: initTrack });
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
  const cpStandings = createCheckpointStandings(courseSet);
  let prevSegmentId = null;
  let activeCarId = choice.carId;
  let activeTimeScale = diffChoice.timeScale;
  let activeDiffLevel = diffChoice.level;
  let raceSummary = null;
  let allTimeBoard = [];
  let summaryStart = 0;
  let initialsEntry = null; // arcade high-score initials UI (solo, when qualifying)
  let pendingResult = null; // the solo result awaiting its initials
  const isHighScore = (result) => {
    const top = topScores(storage, 10);
    return top.length < 10 || isBetter(result, top[top.length - 1]);
  };
  let timeUpSel = 0;      // 0 = RE-JOIN, 1 = SPECTATE (multiplayer time-up)
  let spectateIndex = 0;  // which rival is being spectated
  let lobbyShowQR = false; // invite QR overlay in the lobby
  let prevCrashed = 0, prevFinish = -1, prevTimer = NaN; // SFX edge trackers
  let prevRemoteCd = 0, goAt = -1; // remote countdown -> GO! edge

  function start(carId, timeScale, diffLevel) {
    session = remote
      ? createRemoteSession(`ws://${location.host}`, { courseSet, carSet, startTimeTicks, carId, diff: diffLevel, name: playerName, pid })
      : createLocalSession(courseSet, carSet, { seed: 12345, courseId, startTimeTicks, trafficConfig, carId, timeScale, aiCount, aiSkill: diffLevel });
    if (remote) session.connect();
    activeCarId = carId;
    activeTimeScale = timeScale;
    activeDiffLevel = diffLevel;
    prevCrashed = 0; prevFinish = -1; prevTimer = NaN;
    prevRemoteCd = 0; goAt = -1;
    prevSegmentId = null;
    timeUpSel = 0; spectateIndex = 0;
    raceSummary = null;
    celebration.reset(); // clear finish confetti/splash from the previous race
    crashFeel.reset();
    nearMiss.reset();
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
    // The rejoin button overrides any phase — it only shows while disconnected.
    if (remote && session && rejoinButtonHit(view, session.status, x, y)) { session.reconnectNow(); return; }
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
    } else if (phase === "initials" && initialsEntry) {
      if (initialsEntry.tap(view, x, y)) { // confirmed -> record under the initials
        allTimeBoard = recordScore(storage, { ...pendingResult, name: initialsEntry.text() });
        summaryStart = performance.now();
        phase = "summary";
      }
    } else if (remote && session && session.watching) {
      session.join(); // JOIN IN
    } else if (remote && session && session.lobby && session.lobby.active) {
      const z = lobbyTouchZone(view, x, lobbyShowQR);
      if (z === "closeqr") lobbyShowQR = false;
      else if (z === "start") session.startNow();
      else if (z === "wait") session.toggleWait();
      else if (z === "invite") lobbyShowQR = true;
    }
  });

  // JOIN IN via keyboard while watching an ongoing race.
  doc.addEventListener?.("keydown", (e) => {
    if (e.key === "Enter" && remote && session && session.watching) session.join();
    // R forces an immediate reconnect while disconnected (matches the on-screen button).
    if ((e.key === "r" || e.key === "R") && remote && session &&
        (session.status === "reconnecting" || session.status === "run_ended")) session.reconnectNow();
  });

  // Lobby keys: Enter = start now, W = wait/resume, I = invite QR.
  doc.addEventListener?.("keydown", (e) => {
    if (!(remote && session && session.lobby && session.lobby.active)) return;
    if (lobbyShowQR) { lobbyShowQR = false; return; }
    const k = String(e.key).toLowerCase();
    if (e.key === "Enter") session.startNow();
    else if (k === "w") session.toggleWait();
    else if (k === "i") lobbyShowQR = true;
  });

  let acc = 0;
  let last = performance.now();
  let frameCount = 0;
  function frame(now) {
    // Music track cycle (M) — works in any phase; toast the new track + persist.
    if (readMusicCycle()) {
      const t = audio.cycleTrack();
      announcer.announce(`♪ ${t.name}`, now);
      if (storage) { try { storage.setItem(MUSIC_KEY, String(t.index)); } catch {} }
    }
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
      } else if (phase === "initials" && initialsEntry) {
        if (initialsEntry.handle(ev)) { // confirmed -> record under the entered initials
          allTimeBoard = recordScore(storage, { ...pendingResult, name: initialsEntry.text() });
          summaryStart = now;
          phase = "summary";
          break;
        }
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
    // Watching an ongoing race (joined late): spectate the leader + a JOIN-IN
    // prompt; joining spawns at the current stage (specs/63).
    if (remote && session.watching) {
      const st = session.getState();
      if (st.seats && st.seats.length && st.seats[0]) {
        const sStart = getCourse(courseSet, courseId).startSegment;
        render(g, view, st, courseSet, assets, scenery, { stage: stageNumber(courseSet, sStart, st.seats[0].segmentId), total: stageTotal(courseSet, courseId) });
      } else {
        g.fillStyle = "#1a1030"; g.fillRect(0, 0, view.w, view.h);
      }
      g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(view.w * 0.2, view.h * 0.82, view.w * 0.6, view.h * 0.1);
      g.fillStyle = "#4ce05a"; g.font = `bold ${Math.round(view.h * 0.05)}px sans-serif`;
      g.fillText("JOIN IN", view.w / 2, view.h * 0.87);
      g.fillStyle = "#cfe"; g.font = `${Math.round(view.h * 0.028)}px sans-serif`;
      g.fillText("watching — ENTER / tap to join (you earn from here)", view.w / 2, view.h * 0.91);
      g.textAlign = "left";
      drawConnectionBanner(g, view, session.status, frameCount);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    // Remote pre-race lobby (server-driven): shown until the race actually starts.
    if (remote && phase === "race" && session.lobby && session.lobby.active) {
      drawLobby(g, view, session.lobby, { showQR: lobbyShowQR, url: inviteUrl() });
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    if (phase === "spectate") {
      const st = session.getState();
      // Cycle through rivals in RANK order (server scoreboard by points), not the
      // arbitrary ghost-view order, so ◄/► walks the standings.
      const sb = session.scoreboard || [];
      const rankOf = (seatId) => { const i = sb.findIndex((e) => e.seatId === seatId); return i < 0 ? 1e9 : i; };
      const ghosts = [...(st.ghosts || [])].sort((a, b) => rankOf(a.seatId) - rankOf(b.seatId));
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
        const tPts = (sb.find((e) => e.seatId === t.seatId) || {}).points;
        drawSpectateOverlay(g, view, t.name || `P${t.seatId}`, idx, ghosts.length, tPts);
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
    const remoteCountdown = remote && racing ? session.countdown : 0;
    if (racing) {
      if (remoteCountdown > 0) {
        // Server owns the pre-race countdown and freezes the sim; hold the car at
        // the line (send neutral input) so client prediction doesn't lurch ahead
        // of the server and snap back on GO.
        session.setInput({ steer: 0, accel: 0, brake: 0 });
      } else {
        const kb = readInput();
        // Touch: the wheel gives steer; the lever is a SET SPEED. Convert the
        // lever fraction to accel/brake against the live car speed (cruise), so
        // the engine stays untouched. Keyboard keeps hold-to-go. Gated on
        // showTouch so a desktop user's default lever never forces the throttle.
        const tc = showTouch ? readTouchInput() : { steer: 0, throttleFrac: null };
        let tAccel = 0, tBrake = 0;
        if (tc.throttleFrac != null) {
          const cur = session.getState().seats[0];
          const spd = cur ? cur.speed : 0;
          const target = Math.round(tc.throttleFrac * sel.car.maxSpeed);
          const dead = SPEED_SCALE >> 2; // deadband to avoid accel/brake chatter
          if (spd < target - dead) tAccel = 1;
          else if (spd > target + dead) tBrake = 1;
        }
        session.setInput({
          steer: kb.steer || tc.steer,
          accel: kb.accel || tAccel,
          brake: kb.brake || tBrake,
        });
        const fc = readForkChoice() || readTouchFork();
        if (fc !== 0) session.setForkChoice(fc);
      }
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
    if (state.seats.length) {
      // Local crash shakes the whole scene (decaying); the flash sits on top.
      const sh = racing && crashFeel.active(now) ? crashFeel.shake(now, view) : { dx: 0, dy: 0 };
      const shaking = sh.dx !== 0 || sh.dy !== 0;
      if (shaking) { g.save(); g.translate(sh.dx, sh.dy); }
      render(g, view, state, courseSet, assets, scenery, hud);
      if (shaking) g.restore();
      crashFeel.draw(g, view, now);
      nearMiss.draw(g, view, now);
    }
    // Stage-entry announcement: fire when the car enters a new segment — but hold
    // the FIRST one until the 3-2-1-GO countdown has finished (local or server),
    // so it doesn't collide with the GO text.
    const selfSeat = state.seats[0];
    const preRace = counting || (remote && session.countdown > 0);
    if (racing && !preRace && selfSeat && selfSeat.segmentId !== -1 && selfSeat.segmentId !== prevSegmentId) {
      announcer.announce(stageLabel(hud.stage, getSegment(courseSet, selfSeat.segmentId).nameKey), now);
      prevSegmentId = selfSeat.segmentId;
    }
    // Checkpoint standings board: track every racer through each checkpoint, show
    // the numbered gap-to-leader list for ~5 s when the local car crosses one.
    if (racing && !preRace && selfSeat && selfSeat.segmentId !== -1) {
      const ghosts = state.ghosts || [];
      const racers = [
        { id: selfSeat.id, name: `${playerName} (you)`, carId: activeCarId, segmentId: selfSeat.segmentId, isSelf: true },
        ...ghosts.map((gh) => ({ id: gh.seatId, name: gh.name || `P${gh.seatId}`, carId: gh.carId, segmentId: gh.segmentId, isSelf: false })),
      ];
      cpStandings.update(now, racers);
    }
    const cpBoard = racing ? cpStandings.active(now) : null;
    if (cpBoard) drawCheckpointStandings(g, view, cpBoard);
    // Audio: engine pitch tracks speed; SFX fire on state edges (crash entered,
    // finish crossed, timer bumped up by a checkpoint).
    const self = state.seats[0];
    if (self) {
      audio.setSpeed(self.speed, sel.car.maxSpeed);
      if (self.crashedTicks > 0 && prevCrashed === 0) { audio.event("crash"); crashFeel.trigger(now); }
      if (racing && nearMiss.update(now, self, state.traffic)) audio.event("nearmiss");
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
    // Remote: the server owns the shared pre-race countdown (specs/53). Show the
    // number while it ticks, then a brief "GO!" (with a blip) as it releases.
    if (remote && racing) {
      if (prevRemoteCd > 0 && remoteCountdown === 0) { goAt = now; audio.event("checkpoint"); }
      prevRemoteCd = remoteCountdown;
      if (remoteCountdown > 0) drawCountdownLabel(g, view, String(remoteCountdown));
      else if (goAt >= 0 && now - goAt < 700) drawCountdownLabel(g, view, "GO!");
    }
    announcer.draw(g, view, now);
    if (remote) drawConnectionBanner(g, view, session.status, frameCount);

    // Race end -> summary of the field + a 30 s countdown to a fresh race.
    if (racing && self && (self.finishTicks >= 0 || self.timedOut)) {
      // Multiplayer ranks by the server scoreboard (points); solo by stage reached.
      const sb = remote ? session.scoreboard : [];
      raceSummary = sb.length
        ? sb.map((e, i) => ({ rank: i + 1, name: e.name, color: carColor(e.carId), points: e.points, isYou: e.seatId === session.seatId, finished: false }))
        : buildSummary(courseSet, courseId, carSet, playersFromState(state));
      if (remote) {
        allTimeBoard = session.leaderboard; // MP: server-side board, real names
        summaryStart = now;
        phase = "summary";
      } else {
        // Solo: arcade high-score flow. Only prompt for initials if this run makes
        // the top 10; otherwise straight to the summary.
        const result = { finishTicks: self.finishTicks >= 0 ? self.finishTicks : -1, stage: hud.stage || 1 };
        if (isHighScore(result)) {
          pendingResult = result;
          initialsEntry = createInitialsEntry(playerName);
          phase = "initials";
        } else {
          allTimeBoard = recordScore(storage, { ...result, name: playerName });
          summaryStart = now;
          phase = "summary";
        }
      }
    }
    if (phase === "initials" && initialsEntry) {
      initialsEntry.draw(g, view); // arcade high-score initials over the frozen scene
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
      drawLeaderboard(g, view, allTimeBoard); // all-time board on the right
    }
    frameCount++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
