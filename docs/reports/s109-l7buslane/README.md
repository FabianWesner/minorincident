# s109 — L7 evacuation bus swept lane

## Change

L7 now derives its departure centreline and static-dressing exclusion from one shared lane definition. After L7 dressing is assembled, any authored placement whose baked collision hull or visual AABB intersects the bus's swept envelope is excluded from the L7 layout; L5 retains its original dressing. This removes the legacy school bus, inherited pickup, alley APC and corridor truck overlaps found by the native sweep.

The regression is part of the existing vehicle invariant in `tests/qa/invariants/contract.test.ts`. It loads L7 at HIGH and LOW, sweeps the evacuation bus hull from the authored start through the off-screen endpoint at 10 cm intervals, and checks every resolved non-render-only placement. The previous check covered only building/fence colliders and missed these placements.

## Verification

- Focused native regression: PASS (HIGH and LOW); test budget remains at 150/150.
- TypeScript, lint: PASS.
- Production boarding/departure capture matrix: PASS at HIGH then LOW, including zoom 1; opened both `test-results/r4-bus/roster-24-webgl2-{high,low}/l7-departing-z1.png`. Passengers are visible and the captured bus poses have no wreck intersection. This samples early departure, not the complete timed sweep.
- Scene Lab Northgate: PASS, 240 frames, zero static/actor clipping pairs (`test-results/s109-northgate/metrics.json`).
- L7 threat audit: PASS with no L7 flags. Overall audit exits 1 on three unrelated flags: L4 breach-first-attack, L4 sustained-horde first breach, and L6 breach2 first attack.
- Prescribed remote `npm test`: PASS on 46.225.66.90, 27 files, 106 passed/1 skipped, 220.0 s within 240 s; collection 150/150.


## Completion

Timed HIGH/LOW before/after review is complete. Native sweep, typecheck, lint, remote suite and L7 threat checks are recorded above.

## Timed seed-2 follow-up

Headless production boarding harness completed HIGH then LOW at zoom 1 (also captured 0.5/1.5). At 3.2 s the bus centre is x−44.21075,z47; opened HIGH/LOW originals show a clear cabin and no school-bus intersection at the reported location. Subsequent receipts reach x−9.42 at 5 s, x25.05 at 7 s, x38.94 at 8.5 s and x40 with phase `done` at 9 s. Compact timings are in `timed.json`; originals are under `test-results/s109-timed/roster-24-webgl2-{high,low}`. The harness stages the existing roster at the boarding queue and suppresses infected, as the production evacuation audit does. Matched pre-fix HIGH/LOW images were captured from the parent layout using the same seed-2 harness and opened: at 3.2 s the legacy school-bus roof intersects the coach roof. Fixed images remove that intersection. The fixed source was restored byte-for-byte after the diagnostic. Opened `timed-sheet.jpg` covers HIGH/LOW at 3.2, 5 and 9 s; nearby wrecks remain beside the lane, and the bus reaches the endpoint without intersection. All browser commands used the reservation wrapper, headless Metal WebGL2 and ports 4991/4992.
