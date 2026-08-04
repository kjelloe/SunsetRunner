# 61 — All-time leaderboard

Established in `marker-0084`. A persistent high-score board: **finishers ranked by
total time (faster first)**, **non-finishers by stage reached (further first)**,
finishers always above. Keeps each name's best run.

## Ranking (`shared/leaderboard.js`)

`rankResults`, `mergeResult` (best-per-name, top N), `isBetter`. A result is
`{ name, finishTicks, stage }` (finishTicks −1 = did not finish).
`shared/road_data.stageIndex` gives the stage number (BFS hops, forks-aware),
shared by HUD / summary / server.

## Server (multiplayer, persistent)

`server/leaderboard.js` `createLeaderboard(path)` loads/saves a JSON file.
`game_room` records on each `finish` (time) / `timeout` (stage) event and exposes
`viewFor().leaderboard` (top 10). `startServer` wires `leaderboardPath`
(entrypoint: `.state/leaderboard.json`).

## Solo

`client/local_scores.js` keeps a localStorage board with the same ranking; the
race summary records the player's result and shows the board.

## Display

`race_summary.drawLeaderboard` — an ALL-TIME panel on the right of the summary
(finishers show `m:ss`, others `St N`); the client draws the server board in MP,
the local board solo.

## Verified

`test/leaderboard.test.js` (rank order, best-per-name merge, local persistence),
`test/game_room.test.js` (timeout records to the board + view). `./test.sh` →
277/277 + 4 Luau gates + browser smoke.

## Not verified / deferred

Board look on screen needs eyes. Solo and MP boards are separate (localStorage vs
server file); a unified online board would need an account/id (the `pid` exists).
