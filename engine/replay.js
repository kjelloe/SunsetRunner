// engine/replay.js — run a dumped replay back through the engine.
// A replay IS a scenario (seed + seats + timed input changes), so replay =
// deterministic re-run. Loading a replay and getting the same final hash as the
// live game is the "replay as bug report" guarantee (§21.2). `runToMaxTicks`
// makes the re-run reproduce the exact tick count (no early-stop on finish).

import { runScenario } from "./scenario.js";

export function runReplay(replay, ctx) {
  return runScenario(replay.scenario, ctx);
}
