# 72 — AI difficulty tiers

Established in `marker-0096`. Engine (`ai_driver.js`) + client wiring. **No golden
repin, no Luau change** — see "Why no repin".

## Why

Single-player difficulty (EASY/MEDIUM/HARD) only scaled the checkpoint time bonus
(`ctx.timeScale`). The AI opponents drove identically at every tier, so HARD was
"less time", not "tougher rivals". This ties the AI's skill to the chosen
difficulty so a harder tier fields faster, cleaner opponents.

## The tiers

`engine/ai_driver.js` gains `AI_SKILL` (+ `skillFor(level)`, `DEFAULT_SKILL`):

| tier | lookahead | throttle duty | effect |
|------|-----------|---------------|--------|
| easy | 3000 | 3 on / 4 ticks | dodges late (more crashes), coasts → slower |
| medium | 6000 | every tick | the ORIGINAL behaviour |
| hard | 9000 | every tick | sees threats soonest → cleaner line, stays fast |

`chooseInput(state, seatId, skill = DEFAULT_SKILL)` uses `skill.lookahead` for the
traffic scan and a **deterministic throttle duty cycle keyed on `state.tick`**
(`(state.tick % throttlePeriod) < throttleOn`) — no wall-clock, integer-only, so
AI-driven runs stay perfectly reproducible. A weaker tier lifts off the gas on a
fixed cadence and coasts (drag slows it); a stronger tier watches further ahead.

## Why no repin

`medium` is defined to be the exact prior behaviour (lookahead 6000, gas every
tick — `throttlePeriod` 1 means `tick % 1 < 1` is always true). The AI golden path
(`runAiRace` → `chooseInput(state, seatId)` with no skill) defaults to `medium`, so
its inputs are byte-identical: the pinned AI golden (`3ce72c5877d79295`, tick 307,
1 checkpoint) is unchanged, and the 4 Luau parity gates are untouched (the AI is a
command SOURCE, not part of the reducer/hashed-state contract).

## Wiring

`client/session_local.js` takes `opts.aiSkill` (a level string) and resolves it via
`skillFor`, passing the tier to every AI seat's `chooseInput`. `main.js` passes the
selected `diffLevel` (the EASY/MEDIUM/HARD keys already match the `AI_SKILL` keys).
Multiplayer AI is unaffected (server has no AI seats).

## Verified

`test/ai_driver.test.js` (+3): default/`skillFor` resolves to medium (golden
untouched); easy coasts on the 3/4 duty cycle while medium/hard never lift; hard's
longer lookahead reacts to a 4000-ahead threat that easy (3000) ignores. The
pinned AI-race golden still asserts `3ce72c5877d79295`. `npm test` → 308/308;
`./test.sh` all 4 Luau gates + browser smoke green.

## Not verified / deferred

Whether the three tiers *feel* distinct in a real race (do easy rivals fall back
enough, is hard beatable?) needs the `PLAYTEST.md` device pass. A per-opponent
skill spread (a mixed field rather than a uniform tier) is a possible later slice.
