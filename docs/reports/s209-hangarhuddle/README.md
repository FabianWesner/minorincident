# s209 — L10 hangar infected huddle

## Finding

The hangar-front research cohort is admitted as ordinary `cureRegion` infected. It has no authored hold or scripted route, and the director has ample capacity. In the seed 1 HIGH native trace, the cohort first hears and pursues the courier. As she moves east and beyond its hearing/LOS, the L10 AI releases the chase to wander/idle. `LevelTenEncounters` is responsible for reacquiring nearby authored infected, but its forward-only check required `infected.x >= courier.x - hearing.rangeM`. A member already behind the courier therefore could not be re-pressed, even while it remained inside the 160 m reacquisition radius. The group then lingered/clumped behind the courier.

The sampled actors had no `scripted` route, no pursuit flag, and no stuck counter; the director was well below its cap. This rules out an authored hold, director parking, and the s196 doorway change for this cohort. The s201 scripted-route handoff is also not involved: these are ordinary encounter actors. The loss/reacquisition gap is the cause.

## Change

Removed the east/west position gate from L10's existing idle/wander reacquisition pass in `src/sim/missions/LevelTenEncounters.ts`. Authored infected within its existing 160 m radius can now reacquire the courier after she passes them. Perception, attack, navigation, population, and corpse rules are unchanged.

Folded the regression into the existing HIGH/LOW hangar NPC test in `tests/engine/npcs.test.ts` to preserve the repository's 150-case / 45-file test budget. The test starts a three-member native research-campus group about 40 m behind the courier at the research-exit position, holds the courier in place, and requires a group member to close to contact range within 20 seconds. With the old forward-only gate restored, all three moved farther away (about 40–50 m); with the fix, the test passes in both HIGH and LOW.

## Validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npx vitest run tests/engine/npcs.test.ts --project default --configLoader runner` — PASS (3 tests, including HIGH/LOW hangar regression).
- Full threat matrix — PASS by deterministic shards: `tools/qa/threat-audit.ts --shard 1/2` and `--shard 2/2`, then merged with `--merge`. All ten skilled routes completed; merged audit gate reported **0 fail flags**. The detailed receipt includes one L8 skilled reachability diagnostic; passive acceptance flags are zero.
- `npm run qa:threat` — the unsharded command hit its 600 s browser reservation cap during cleanup (exit 124). The same complete stage list passed in two foreground shards; the merged receipt is `test-results/qa-threat/audit.json`.
- `node node_modules/vitest/vitest.mjs run --project default --configLoader runner` — PASS (27 files, 106 tests). `npm test` itself hit its 240 s watchdog before reporting results; the direct full run completed in 314.8 s.
- `sh tools/remote/run.sh "$PWD" -- npm test` — BLOCKED before execution: no healthy remote runner. `sh tools/remote/scale.sh add` could not provision one because outbound DNS/network access is denied. Local `npm test` also hit its 240 s sandbox batch limit without reporting an assertion failure; the direct local full suite passed, but this is not a green remote-suite result.
- HIGH zoom 1 before/after screenshots — NOT CAPTURED. The browser pool could not bind its loopback port (`listen EPERM` on 4329); the legacy `e2e-lock` path then failed because the sandbox denies `ps`. No browser window was opened.

## Open

The time box ended with remote `npm test` and the requested visual before/after capture and review still open. The earlier environment denied remote network, browser/OS process tools, and Git metadata writes. The fix and this report are committed as the time-box handoff; the incomplete checks above are not claimed as passes.
