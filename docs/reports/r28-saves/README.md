# r28-saves: save compatibility with PROD builds, and QA checkpoint fixtures

Base: main 72e00226 (src identical to the merge 3ef8a77b). Native only; one headless browser (port 4885, `tools/e2e-lock.sh`) to verify the fixtures load.

## 1. Why the tracked L10 corridor save no longer decodes

`docs/reports/sweep-c5/L10-05/seeds/L10-05-high-cure-corridor-save.json.gz` (11-06) fails `validateSave` through `validCureCheckpoint`: its `state.steps` / `completedObjectives` use the old L10 step ids (`residential-fringe`, `industrial-area`, `military-zone`, `research-campus`, `destroyed-corridor`), HEAD's mission defines `farmstead`, `restricted-zone`, `research-hangar`, `delivery-corridor`. Diagnosis with `tools/qa/r28-diag-save.ts` (lists the failing clause). The campaign part of the save is valid; only the mid-level record is stale.

## 2. Do real player saves break the same way? Yes, for L10 saves written by batch 59 (P1 for those players)

Method: `tools/qa/make-checkpoint.ts` run natively (sim bots, `SaveStore.write` so the string is exactly what the game stores) in a checkout of each PROD commit, then decoded and resumed at HEAD by `tools/qa/r28-check-saves.ts` (`decodeSave`, `loadLevel`, `loadResume`, 120 ticks, player alive, checkpoint unchanged). Evidence JSON in this folder.

| Version | Level-select saves L2..L10 (9) | L9 crash record (driving, crawl) | L10 mid-level, 9 checkpoints x checkpoint/live record | Verdict at HEAD before fix |
|---|---|---|---|---|
| batch 59 (2741447) | 9/9 ok, resume ok | 2/2 ok, resume ok | **0/18 decode** (`status: error`) | players with an L10 mid-level save lose the whole campaign ("Start new") |
| batch 60 (1938e59a) | 9/9 ok | 2/2 ok | 27 checkpoints + 21 live records = 48/48 ok (incl. resume) | OK (all save-related source identical to HEAD: `git diff 1938e59a HEAD -- src/sim/progression src/levels/L10 src/data/l10Story.ts` is empty) |

Notes:
- b59 had 9 L10 checkpoints, b60 has 27 (cure-pace-N added), so no 1:1 mapping of an old checkpoint to a new one exists; entity ids and the route changed too.
- L1 to L8 only persist the campaign (no mid-level state): nothing to break beyond the level-select save, which decodes. L9 crash records of b59 decode and resume.
- b59 vs b60 is the only break found. Whether any player is affected depends on who saved mid-L10 on b59 and has not played since; PROD is already b60 or later, so they hit it on their next load.

## 3. Migration (not a reset)

`src/sim/progression/Save.ts`: `decodeSave` now salvages. If validation fails and the save has a `cureResume`, `l9Crash` or `transport` record, those records are dropped one by one until the save validates; the result is `{status:'ok', save, dropped:[...]}`. The player keeps gear, upgrades, completed levels and results and restarts the level (L10: from its start with the crossing handover; L9: from the crossing start). A genuinely damaged campaign (bad seed etc.) still returns `error`. Result type gained an optional `dropped`.

After the fix at HEAD: b59 29/29 saves decode and resume (18 of them with `dropped: ["cureResume"]`, player alive at the L10 start checkpoint `cure-crash`); the old 11-06 corridor fixture decodes as well. Results: `b59-at-head-after-fix.json`, `b60-at-head.json`, `b59-at-head-before-fix.json`.

Unit test (folded into the existing "save decoding" test in `tests/engine/save-progression.test.ts`, the suite is at 150/150 cases): fixtures per version in `tests/fixtures/saves/compat/`, L2..L10 level-select, L9 crash, and L10 checkpoints (b59 steps dropped with progress kept, b60 resume kept), plus a damaged-save negative.

Not done: mapping an old L10 checkpoint to a new one (a true mid-level resume). Players restart L10 from its beginning. If the PO wants better, it needs an authored old-to-new checkpoint table and entity remapping.

## 4. QA checkpoint fixtures (tests/fixtures/saves/qa, README there)

`l8-before-lion`, `l8-before-gorilla`, `l8-before-elephant`, `l8-elephant-apc-yard-engaged`, `l9-before-rail-stall` (x >= 320, rail at 380), `l9-at-bridge`, `l10-dispersal-console` (checkpoint `cure-disperse-ready`, `cure-installed` true). 75 KB to 199 KB each (two as brotli `.json.br` because gzip exceeded 200 KB).
- Generator: `tools/qa/make-checkpoint.ts --what qa` (also `campaign,l9,l10` modes for the compat matrix). Loader: `tools/qa/load-fixture.ts` (CLI + `loadFixtureInPage`), native check `tools/qa/check-fixtures.ts`.
- New game hook: `Game.loadLevel` / `__SS__.loadLevel` option `resume` (begin mission + `Mission.loadResume`), needed because L8 has no persisted mid-level save. L9/L10 fixtures are real save records (`campaign.restore` + `loadLevel`).
- Verified natively (300 ticks, player alive, expected checkpoint/phase) and in one headless WebGL browser (low quality, 7 fixtures, no page errors; HUD shows the elephant objective "Phase 1", APC armour bar at the yard, and "Activate the dispersal console . 12 m" for L10). Captures: scratchpad only, not committed.
- `play.ts --entry` save import: not extended; `load-fixture.ts` plus `seed.ts`-style `campaign.save()` cover it (see fixtures README).
- Note l8-before-lion/gorilla start at checkpoint `sanctuary` (no arena engaged yet); the lion/gorilla arenas then engage when the player walks in (30 m).

## Checks
tsc clean; eslint clean on all touched files; `tests/engine/save-progression.test.ts` on the remote runner (see report summary); `npm run test:gate` see summary. Browser: 7/7 fixtures loaded.
