# E19 M1 navigation follow-up

The larger delivered hedge/tree footprints exposed sampled visibility gaps, conservative corner stalls, and a bench crossing the residential approach. Navigation now checks whole segments against relevant collider boxes, allows outward escape from expanded corners, and uses 0.5 m grid / 0.45 m survivor steering clearance. Spatial buckets bound visibility work. Flower strips explicitly produce no walking collider, including stale layout fallback footprints. Hedge solids, gas pumps and canopy legs retain physical collision.

Moved only the bench at (-18,-4.6) to (-22,-4.6), updated its Blender authoring placement, and rebuilt the delivered D-RES layout JSON/base GLB. Unchanged decay-tier GLBs were retained. Low quality now switches distant instances to LOD2 at 20 m; high quality retains 30 m. This fixes the existing mobile district-join triangle failure (512,458 against a 500,000 budget); the seven-spot check now peaks at 456,234.

Ran `npm run assets:collision` against delivered GLBs. Generated static collision was byte-identical to the committed cache; the baked-cache freshness test passes. Hedge/tree SHA-256: `2d72e2773daded3cc65de306bbb6005c161342e389dc1b5e5060c7a5cd56acfa`.

The full E19 run also exposed an unrelated desktop combat-test setup issue: enemies spawn offscreen, but the test projected their positions to x=1759–1931 outside its 1600-pixel canvas and sent no combat input. The test now approaches through real ground clicks before targeting. All hit, trail, particle, attachment and clip assertions remain. The three corrected desktop weapon cases pass; touch combat passed unchanged.

## Validation

Before the final main merge: typecheck, lint and build pass; all 172 unit tests pass; E19 simulation selection passes all 36 tests. Focused browser navigation, mobile budget and corrected desktop combat checks pass. The last full E19 rerun was interrupted at the scheduler time limit (16 browser passes, no reported failures). Per the orchestrator, final validation after merging current main is limited to typecheck, lint, unit, smoke and the two focused navigation checks; full E19 is not rerun. Final post-merge results are pending.

Focused navigation/AI regression: 20 tests pass. Real-input hedge-to-forecourt routes pass on desktop and iPhone portrait; all three complete L1 routes and checkpoint recovery passed in the full browser run. The mobile seven-spot visual/budget test passes. Inspected desktop/portrait hedge and forecourt captures: the approach is open, survivor/corgi reach forecourt paving under the canopy, pump/leg solids remain distinct, and HUDs are readable. The corrected desktop bat capture shows real combat contact. Captures are temporary verification artifacts.

All browser runs use headless Playwright via `tools/e2e-lock.sh`, one worker for E19 (at most two for other runs), port 3353 and Metal WebGL2 on this Mac. iPhone is an emulated profile on the native M1 Max GPU. The verifier locks only browser runs; typecheck, lint, builds and unit tests run without it. E19 allows 120 s wall time per simulation test on the shared Mac; seed counts, gameplay tick budgets and behavioral assertions are unchanged. A later two-worker rerun encountered shared-machine wall-clock timeouts on portrait cases that had already passed; the verifier now uses one worker for E19 to reduce contention. The orchestrator supplied the browser-run lock update, matching main; its latest default permits one run at a time (configurable with E2E_SLOTS).

Worktree `lane/m1-nav-fix` merged main once at startup (already current), then rebased onto main `0566e19` to include upstream gait fix `877fc28`, which clears three baseline animation unit failures. This lane makes no animation implementation or specification changes.

Fix commits: `6b5b0ef`, `031e73d`, `05abf49`, `ac90aa6`, `e58467b`, `13710a2`.
