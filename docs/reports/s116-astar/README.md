# s116 — resumable infected A* (in progress)

Current base: `e1901bb7` (includes s114 and s115). Initial implementation saves sparse visited-cell state and the heap per reused output path array in a WeakMap; retries restore that state after other requests use the workspace. Endpoint and geometry revision changes discard obsolete progress. Existing expansion budgets and retry scheduling are unchanged. Native campaign validation is outstanding.

## Confirmed mechanism

`src/sim/ai/NavGrid.ts` retains a single mutable A* workspace: parent, cost, open, seen stamp, heap, endpoints and cumulative search size. `path()` resumes only when its endpoints match the currently active search. Another request replaces those endpoints and clears the heap. The retry delay in infected steering consequently yields fairly but discards long search progress.

`InfectedSystem` resets the normal budget to 2000 expansions per tick and wide budget to 12000. `steerL1` also caps route attempts at four; unsuccessful routes wait 15 ticks. `seek` applies the 15-tick delay to army approaches. These limits must stay intact.

Geometry mutations explicitly invalidate active searches. Any retained request state must also be invalidated by `NavGrid.revision`; restoring old geometry search state would be incorrect. Request ownership must distinguish callers even when they temporarily share endpoints, and must release abandoned request state without retaining dead actors.

## Required evidence before completion

- Interleaved long requests complete over bounded retries with each call respecting its supplied budget; changed endpoints and geometry discard obsolete progress.
- Native L4 seed 1 HIGH/LOW full alarm holds: zero requests pending for more than 10 seconds without completion; capture actor 298's completion and the stationary-outside census.
- Baseline s115 final census: HIGH 2 / LOW 1; HIGH first breach 72 alive and sustained plaza minimum 40. Re-measure current base and final implementation rather than treating historical results as current measurements.
- Full threat audit: compare current and final flags (expected baseline zero after s114).
- Vehicle campaign motion through e2e-lock, headless and serial, ports 4961/4962.
- Typecheck, lint, focused regression checks and full unchanged remote unit suite.
- Explicitly staged commit with final report and compact JSON evidence.

Browser QA needed.

## Focused validation

- Typecheck: passed.
- Lint: passed.
- Interleaved route regression: passed; two competing routes complete with an eight-expansion call budget and contiguous valid paths.
- Full threat audit, current-base/final HIGH and LOW starvation measurements, vehicle campaign motion and remote unit suite: outstanding. This is not a completion claim.

Remote suite first attempt stopped at manifest admission (151/150 cases), before running tests. The interleaving regression is now included in the existing A* test so all coverage remains within the unchanged 150-case budget. A fresh remote run remains required.

## Full validation attempt at 8abc091c

Remote unit suite passed on 46.225.66.90: 27 files, 106 passed / 1 skipped; 217.6 s within 240 s. Full threat audit completed in 438.0 s with three aggregate flags: L3-06 squad counts/losses, L3-11 native competent rate, and L10 hold STUCK_CHASER_OVER_30_SECONDS. L4 has zero flags. These failures require current-base comparison and investigation; no no-regression claim is made. Compact receipts are in evidence.json.

## Regression isolation

A diagnostic L3/L10 audit with the base e1901bb7 NavGrid passes both levels (only PARTIAL_LEVEL_SELECTION remains). This confirms the candidate introduces the L3/L10 aggregate failures. An opt-in retention variant restricted to infected callers also failed L3/L10 and added a passive flag; it was discarded. Current committed gameplay remains the initial incomplete candidate. The goal is not achieved; do not merge this candidate until the regressions and direct 10-second request lifetime checks are resolved. Vehicle campaign validation is also outstanding.

The identical-endpoint sharing variant was also tested and discarded: preserving the original shared active search for callers with identical endpoints still produces L3/L10 failures. This rules out output-array ownership changes for identical endpoints as the sole regression cause. Further investigation must inspect restored-route correctness and long-route behavior in those levels.

## Direct native trace (preliminary)

HIGH seed 1 actor 298 requests at tick 3011 and receives its path at tick 3086: 75 ticks / 1.25 s, six calls, 9752 total expansions across calls. This confirms completion of the originally traced long route under the unchanged tick budget. The preliminary full HIGH/LOW probe also records abandoned goals, so its raw unresolved episode count is not a valid starvation metric. Cancellation classification is required before claiming zero starvation. The probe is tools/qa/s116-path-probe.ts.

## Cancellation-aware trace

The observer now records superseded destinations, exhausted searches and actors leaving navigation. It still counts requests unresolved at their 600-tick deadline even if canceled later. HIGH retains one overdue request: actor 330 completes after 714 ticks (11.9 s), four calls. LOW retains one: actor 242 requests once at tick 3031 and leaves navigation at 3729 (698 ticks). Thus the zero-overdue requirement is not yet satisfied. Current tool typecheck and lint pass. These cases need per-tick steering inspection, including whether direct steering legitimately superseded navigation without a subsequent path call.
