// engine/copy_state.js — deep clone of engine state so the reducer stays pure.
// Every new positional field added to a seat must be copied here (gotcha #2).

export function cloneState(state) {
  return {
    version: state.version,
    tick: state.tick,
    seed: state.seed,
    rng: { ...state.rng },
    race: { ...state.race },
    seats: state.seats.map((s) => ({ ...s })),
    traffic: state.traffic.map((t) => ({ ...t })),
    hazards: state.hazards.map((h) => ({ ...h })),
    spawnedSegments: [...state.spawnedSegments],
    nextTrafficId: state.nextTrafficId,
    nextHazardId: state.nextHazardId,
    events: state.events.map((e) => ({ ...e })),
  };
}
