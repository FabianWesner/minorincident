# s31-healthbars

## Cause and change

The old predicate revealed any damaged infected or any healthy infected within 15 m. Nearest-N selection then discarded eligible targets after 6 bars (5 on L10), including zombies already shot by the courier.

Eligibility now follows interaction: a living infected retains its bar after positive player-attributed damage, regardless of range or population. Otherwise it needs courier targeting within 6 m. Shields, Alphas, engaged arena bosses and the pursuing Mega retain mandatory bars. Dead, hidden and corpse actors remain excluded. Follower survivors, escorts, following soldiers/officers and the L3 squad retain bars; groups above five use compact pips. Removed L5 shutter and pre-cure Mega suppression to honor the rule across levels.

The serializable infected `hitByPlayer` flag is set in the shared damage resolver and reset when a pooled actor is reused. Bullets, melee, explosives and status damage share this path. Secondary environmental sources retain `playerDamageSource`; weapon fuel patches, blast aftermath and spreading fires carry it forward. These flags add no per-frame allocations and change no health/damage stats. Nearest-N arrays, sorting and ID sets are removed; existing instanced layers remain (400 slots per layer versus quality infected budgets of 200 high / 100 low). Visibility still follows the viewport and solid occlusion.

## Assertions and checks

Assertions were folded into the existing single l4-contact case: player bullets/melee/explosives/status, weapon ground fire, ally-only damage, near idle actors, courier/ally targeting, mandatory Alpha/shield bars, death and pool reuse. Diagnostic callers were updated for the simplified predicate signature. The case budget remains 150/150.

Typecheck and lint passed during development. The focused health-bar case passed. The first full gate completed 106 passed / 1 failed: the existing review-freshness assertion at gate-tools.test.ts:74 compares HEAD rendering sources to the dirty worktree, so it correctly reported STALE while this lane was editing. Final clean-commit gate validation is recorded below after execution.

## Scene Lab

Ran `SCENE_PORT=4904 E2E_UNITS=1 npm run scene -- <specs> --backend webgl2 --tier <low|high>` through the package script's `tools/e2e-lock.sh`, sequentially with one headless browser. No port 3300 or headed browser was used.

All four specs in `tests/scenes/health-bars/` passed at both tiers and zoom 1 / 1.5: **16/16**. Per-matrix maximum draw calls: low z1 30, low z1.5 33, high z1 30, high z1.5 33. Console errors and clipping were zero. The new night fixture uses real pistol attacks on three of eight infected; the four uninvolved actors start far enough away to remain outside direct engagement during the 90-frame sequence.

Opened and inspected all four new-fixture frame-90 PNGs. Each has exactly four visible bars: three partly depleted bars on the shot infected and one full bar over the close attacker beside the courier. The other four have none. At zoom 1.5 all eight figures fit; at zoom 1 some distant uninvolved actors reach the frame edge. Red fills and white outlines remain readable on the dark street; high adds shadows without changing eligibility.

Evidence (ignored raw captures, not committed): `test-results/s31-{low,high}-z{1,1.5}/`, including metrics and PNGs. An initial development scene reload destroyed one execution context; the subsequent complete matrix passed.

## Final validation

- `npm run typecheck`: PASS on final code.
- `npm run lint`: PASS on final committed code.
- `npx vitest run tests/engine/l4-contact.test.ts --maxWorkers=2`: PASS (1 existing case, 20.05 s).
- Scene Lab: PASS 16/16; captures opened as described above. Also opened the existing occlusion/shared/zoo final frames: no bar through the house, nearby interacting runner bar, idle zoo actors without bars.
- Clean-commit `npm run test:gate`: FAIL. First attempt reported a navigation long-route timeout (~30 s) and was terminated at 241.0 s. Retry with `npm run test:gate -- -- --maxWorkers=2` reported no assertion failure but exceeded 240 s (241.1 s); its wrapper also raised a cleanup PermissionError, and the child was subsequently confirmed absent. A final default-four-worker attempt, started when no other Vitest process was present, reported no assertion failure but was terminated at its 237 s browser reservation limit, total 240.7 s, exit 124. Logs: `/tmp/s31-gate-final.log`, `/tmp/s31-gate-two.log`, `/tmp/s31-gate-quiet.log`.

No limits or tolerances were changed. No checks remain running. The implementation and visual verification are complete, but the requested green full gate is **not achieved**; this lane must not be represented as fully verified or ready to merge. The remaining action is to obtain a successful full gate within its existing budget.

### Follow-up gate profiling

A further clean-commit run with `npm run test:gate -- -- --reporter=verbose` confirmed the review-freshness assertion passes. The unrelated navigation long-route case timed out at 38.126 s; the full run again reached its reservation limit (241.0 s, exit 124). Verbose output also measured asset validation at 42.449 s and player movement at 50.174 s, demonstrating substantial time outside health bars. Evidence: `/tmp/s31-gate-profile.log`. This run has exited; no owned check remains live. The full gate remains unmet, and its limits were preserved.
