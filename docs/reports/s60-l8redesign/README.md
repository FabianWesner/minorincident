# s60 L8 redesign, part 1

## Changes

- Kept the existing path and L8 gate state machine, shortened route prompts, moved route markers to each entry gate, and move the marker to the arena centre after entry. Completed exits close once the whole party is through the next entry gate.
- Added compact 28 m inner fence pens inside the existing zoo enclosures, paved spurs to their gates, and compact monkey and elephant arena bounds. The new placement geometry is appended after the existing layout placements to preserve their IDs.
- Changed habitat floors to a light sidewalk material. Added an arena outline to the minimap and restricted L8 threat dots to living infected inside the active arena.
- Replaced fight objective tips with short kill counters. Existing encounter announcements continue to show the arena tip once as a subtitle. Kept the plaza breach and finale flow.
- No animal models, motion code, or §3 flamingo mechanic changes.

## Captures

None. The D-ZOO assets could not be rebuilt in this restricted checkout, so no runtime capture is representative of the changed layout.

## Checks

- `npm run typecheck`: pass (also re-run directly through the TypeScript CLI after the final gate changes).
- `npm run lint`: pass before the final small gate/test edits; rerun required.
- `node --import tsx/esm node_modules/vitest/vitest.mjs run --project default tests/engine/missions.test.ts --maxWorkers=4`: pass, 6 tests.
- `npm run layouts:build -- D-ZOO`: blocked. The `tsx` wrapper cannot create its IPC socket in this sandbox. Calling `tools/layouts/build.ts` directly avoids that wrapper, but Blender 5.2.2 crashes in its Metal backend probe before the layout script starts. Restore of incidental generated physics metadata was verified.
- `sh tools/ops/slim-worktree.sh "$PWD"`: blocked because it cannot write the linked `.git/worktrees/.../config.worktree` outside the writable workspace.
- Smoke, threat audit, nightly invariants, full `npm test`, and real-input playthrough/captures: pending. Smoke and playthrough require the rebuilt layout; remaining checks have not completed yet.

## Remaining for part 2

Rebuild and validate the D-ZOO output, capture the actual gated route and zoom-1 pens, run the requested audits and real-input path through flamingo → lion → monkey, then score the arena presentation. Part 2 still owns the flamingo rework, signature-attack telegraphs, and deliberate 3–4-piece arena cover pass.

## Continuation validation (2026-11-12)

Filesystem access restored. `slim-worktree.sh` now passes. D-ZOO rebuilt successfully (source hash `71f158d2adc0f3649cf451249f8817bdee4a950d6ecfea0b792387118a517913`). The required smoke run on 4965/4966 completed: 5 passed, 1 failed because L8 load rejects road lane overlaps for crowd-fence placement IDs 2007, 2008, 2022, 2023, 2024. These overlaps must be fixed before playthrough. Latest lint and main TypeScript check pass; mission scenarios remain 5/6 with Hale charge distance Infinity. Earlier pass above predates the final elephant geometry and is superseded. Threat audit reported tunnel-breach first attack 30.45 s; remote checks and captures remain pending. None of these pending validations belong to part 2; they remain required for this lane.

Rebuild continuation: corrected appended placement allocation after filtering (duplicate fence IDs were detected during mission loading). Build succeeded with hash `e1b0021815b05f3829739f45974a0ba1f728fd50dbd4a00e44d88b7525d5e46a`; generated placements now have zero duplicate IDs. Elephant gate openings widened for the vehicle lane, obsolete western through-road edge removed. Runtime checks still pending.

Finale/route continuation: fixed the Hale charge story predicate to use the bounded elephant arena instead of the external vehicle door. Focused mission test then passed Hale assertions and advanced to route checks. Arena zones now match actual fence lines (previous inset left followers outside the declared zone after crossing). Latest mission failure is zebra containment at `(44.8,13.1)`, outside the compact pen; remains unresolved. Remote nightly job `s60-l8redesign-990e7a-31995-1794443133` reports high/low wave census failures with east-outlet infected stuck emerging; full job still running at this entry.

Remote nightly completed (exit 1, 436.57 s): 5 passed, 4 failed. Failures: asset inventory (14 supermarket validation errors), placement vs solids (170 new L8 overlaps), high/low wave census (L8 east tunnel authored/admitted mismatch and emergence failures; high also L2 23/24 reached). Reports and failures must be addressed or proven pre-existing; checks are not green. No checks remain running.

Calm animal placement now places lions, gorillas and zebras inside their compact pens instead of outside their new fences. Latest focused test stops at the earlier tour visibility assertion (animal 397 at 20.69 m, limit 18 m); Nadia tour stops need adaptation to compact pen positions before containment can be rechecked. No checks running.

Tour continuation: routed Nadia to public viewing stops at the compact pens; the lion stop waits for courier proximity before its line. Calm tour limit and story fixture allow 180 s for the longer fenced route. Latest mission run passes tour, Hale and route assertions, then fails the later corpse detour fixture (`queue head beside the elephant finds a way out`, missions.test.ts:203). This fixture/exit obstruction needs diagnosis; no tests running.

Boarding fixture continuation: the corpse-detour fixture restored sanctuary, leaving the new elephant exit locked. It now sets arena phases cleared for boarding and restores them afterward; corpse detour assertion unchanged. Local missions test passes 6/6 (60.07 s), and `npm run typecheck` passes. Required remote `npm test` attempted with 150/150 registered cases; failed on its 240.7 s budget/235 s reservation limit before completion, with reported vehicle, L4 contact, world-systems, navigation and player failures. These need base-revision comparison; not declared pre-existing. No processes/checks remain running.

Overlap cleanup in source: local solidOverlaps scan reproduced 170 new pairs, mostly duplicate flamingo side fences, elephant west boundary, and dressing. Layout now reuses continuous flamingo sides, extends the elephant west wall only beyond the existing enclosure, and filters dressing/obsolete panels beneath appended fences after allocation. Python syntax passes; rebuilt geometry and overlap rerun still required. No check running.

Overlap cleanup validated: D-ZOO rebuilt successfully (hash `aaa45821b0c28c04b5c710574ef66a668e1a87d88543f050cd8ee5ac0355f362`). Generated placements have zero duplicate IDs. Local tier-5 solidOverlaps scan using nightly predicate/baseline reports zero new overlaps (previously 170). Focused mission suite passes all 6 tests against rebuilt geometry (52.12 s). Full nightly tiers, smoke, audit and real-input captures still required. No checks running.

Post-cleanup smoke: `E2E_PORT=4965 SCENE_PORT=4966 npm run test:smoke` PASS, 6 QA browser tests + 1 public-build test, 148.2 s. Uses e2e-lock and headless pooled browsers, max 2 workers. Earlier road-overlap load errors no longer occur. Marker-follow real play, captures, threat audit and final nightly/full-suite resolution remain pending. No check running.

Real-input attempt 1: `r28-vqa-fixture-play.ts http://127.0.0.1:4965 level:L8 --backend webgl --zoom 1 --seconds 180 --shot 15 --follow-marker`, through e2e-lock, one headless browser, god OFF. Completed without browser errors; tour/breach/hold reached sealed checkpoint, ended 6 m from flamingo entry marker. Does NOT satisfy flamingo→lion→monkey acceptance. Opened captures `play-start/s001-t901.jpg` (marker on paving, but entrance path has visible open grass beside it) and `play-start/s011-t9940.jpg` (plaza hold marker extends across grass). These expose unfinished path boundaries/paving and must be corrected. Captures/log retained in play-start/. Preview server stopped; no check running.

Capture-driven source changes: arrival boulevard lawn edges now have appended fixed fences at x20.9/27.1 (junction openings retained), and plaza hold floor is light paving throughout its bounded 28x24 m space. Python syntax passes. Rebuild/overlap checks and visual rerun required; remaining route segments still need perimeter audit. No check running.

Boulevard/plaza rebuild passed (hash `3a61aaad8c5d7907c00393fc0f9a564f0bdf148d8c2021b05cf37afc01bd7b07`); local nightly-equivalent placement scan reports zero new overlaps at every tier 0–6. Subsequently fixed source route inconsistency: monkey east exit now connects by paved spur to x24 boulevard, zebra waypoints follow that boulevard rather than returning through closed monkey entry. Added corresponding fence openings. This subsequent connection still requires rebuild and real play. No checks running.

Monkey exit connection rebuilt successfully (hash `1efeae9906c94b03e02d0c0cb301b25e7695df4a9ff8ec633dd7c7757a11392c`). Tier-5 nightly-equivalent overlap scan: zero new pairs. Mission scenarios: 6/6 pass, 72.28 s. Marker real play and smoke after this rebuild still pending. No check running.
