# L8 opening order and guidance

## PO finding

2026-11-08: the PO could reach the armored vehicle around 52 seconds into the opening, before the zoo breach or fight, with the whole group boarding. The opening step had been the APC escape objective from tick zero. This made `depart` available as soon as the player boarded, bypassing the intended story order.

## Change

L8 now starts with a `sanctuary` objective, “Lead the group to the zoo gate”, anchored at the zoo entrance. Its completion is tied to the scripted breach, not proximity or player actions. Only then does `escape` activate and point to the APC. APC driver boarding, survivor queueing and driving remain gated on the breach and appropriate active step. The calm objective, distance, world marker/edge arrow and minimap destination stay visible during the 60-second opening.

The L8 acceptance criterion E30-AC04 and its test-plan row were amended to reflect the PO's 2026-11-08 direction. This supersedes the previous “no waypoint” criterion, which left the player without a destination and let the APC objective start too early.

## Verification

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- Focused engine tests (`missions.test.ts`, `vehicles.test.ts`): pass, 8 tests.
- `npm run qa:accept -- --level L8 --skip-browser`: 0 fresh failing rows; 10 incomplete browser-only rows. Native calm, marker order, fixture and checkpoint clauses pass at low/high tiers.
- `npm run qa:threat -- --levels=L8`: L8 skill and passive routes completed with zero passive flags; the report includes the expected `PARTIAL_LEVEL_SELECTION` scope flag for an L8-only diagnostic run.
- `npm test` (150-case cap): 105 passed, 2 failed. `tests/engine/navigation.test.ts` timed out under load; `tests/tools/gate-tools.test.ts` review-freshness expectation failed. Neither failure touches L8; isolated reruns pending.
- Real-input browser captures at zoom 1/1.5 and low/high quality, fresh and progressed starts: **blocked**. The headless browser-pool launcher failed before Chromium startup because sandbox policy returned `EPERM` binding `127.0.0.1:4329` (see `/var/folders/0d/d1pz5009603g0jcd5r3j353c0000gn/T/mi-browser-pool.log`). The capture runner is [l8-opening-capture.ts](../../../tools/qa/accept/l8-opening-capture.ts); it is ready for a browser-enabled rerun.

## Disk cleanup

At the urgent space request, removed this worktree's `test-results/`, the temporary QA `dist/`, and stale `/tmp` QA dist caches, profiler traces, baseline JSON and image data. The generated `test-results/` files were not linked by this report. No contact sheet or new screenshot set was retained.
