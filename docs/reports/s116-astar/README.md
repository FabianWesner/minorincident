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

## Goal reset observation

Per-second native traces show both previously overdue actors reset their cached route goal to -1 before ten seconds. LOW actor 242 also switches from the west breach to the inside courier goal while walking. The observer now records cached-goal invalidation each tick; fresh HIGH/LOW native holds report zero requests still required and uncompleted at the ten-second deadline. These are explicit cancellations, not successful path completions; the earlier raw overdue results remain in the evidence history. The all-level audit regressions remain unresolved, and this measurement does not make the candidate mergeable.

A retention variant that saves only requests which have already accumulated at least 2000 expansions still fails L3/L10 (three aggregate diagnostic flags including partial-selection). It was discarded. This rules out saving only short partial requests as the sole regression mechanism; no arbitrary retention threshold is retained.

## Restored route correctness

The existing A* regression now compares interrupted routes against uninterrupted A* on twelve deterministic obstacle layouts, with a competing reverse request between each eight-expansion slice. Every resumed route exactly matches the uninterrupted route and respects the supplied expansion budget. The focused A* test passes. This strengthens evidence for correct restoration on those layouts; it does not explain the native L3/L10 behavior changes or clear the audit failures.

## Vehicle campaign gate

All eight HIGH/LOW vehicle campaign motion cases pass: L9, L7 bus, L4 parked, L4 tank. Run once on the current candidate through tools/e2e-lock.sh and the browser pool, one serial headless browser, ten-minute reservation, E2E_PORT/SCENE_PORT 4961/4962. Every case reports sourceStable=true. Receipts are retained in evidence.json. The L3/L10 threat regressions remain open.

Current-tree typecheck and lint were rerun after the finalized observer and obstacle-layout regression: both pass at 5c0a3dd0. Native L3 army-line evidence is now retained side by side in evidence.json: base officer counts 4/3/0 across seeds 1–3, candidate 2/1/0. L10 candidate hold flags actor 120 as a stuck chaser, while base does not. These remain behavioral regressions requiring implementation work; static checks and vehicle passes do not waive them.

Two further isolated variants were tested and discarded: monotonically allocating visited stamps independently of failed-pocket restoration, and using startCell in seek instead of nearestCell. Neither changes the L3/L10 regression outcomes. Neither speculative implementation change is retained.

L3 seed-2 loss probe now observes the mission-authoritative outbreak.bite and l3.squad-lost events. Candidate squad losses occur at ticks 9277 (source 691 → officer 30), 9361 (1136 → 32), and 9492 (835 → 31), around x=114–116 / z=-23–-22. The last bite has turns=false but still causes a squad loss under existing mission rules. No combat.hit ally events are emitted for these outbreak bites. This identifies the actors and encounter for the next route comparison; mission loss rules are unchanged.

Explicitly canceling retained searches when infected steering invalidates b.goal was tested against L3/L10 and produced identical outcomes. That diagnostic API and caller changes were discarded. Reusing an abandoned frontier after b.goal resets does not explain the observed audit regressions.

The L3 seed-2 attacker probe now records navigation calls for 691/1136/835 from tick 7000. Base actor 691 is near z=31.7 at tick 7207; candidate actor 691 is near z=4.6 at 7184, showing earlier state divergence. Candidate 1136 records eleven pending calls and completed cumulative searches up to 4000 expansions; base has no path calls for that ID in this window. Matching IDs therefore cannot be assumed to share the same prior position/history. Compact route summaries are retained for the next earlier-divergence trace.

The first restored searches in native L3 seed 2 occur at tick 2337 for runner 129 from wanderL1, then 2338 for runner 172 from searchL1. Each expands another 2000 nodes for cumulative 4000; search actor 172 continues to 6000 at tick 2356. This identifies exploratory search/wander routing as the earliest observed use of retained progress, before the late squad encounter. Next investigation should examine these callers’ intended pending-search handling rather than infer the cause from late attacker IDs.

A diagnostic that disables retention for wander/search probes while keeping directed routes retained clears the L10 passive flag but worsens L3 army counts to 0/0/1. It was discarded: narrowing the fix to directed routes would not meet the original scope and still fails L3. This distinguishes the L10 exploratory-retention effect from L3’s separate directed-route effect.

L10 actor 120 uses seek (no L1 brain), remains chase with a nine-node path at index 8, and stays near (3999.05,-29.67) for the hold while the courier is near (4002.54,-28.64). seek only rechecks cached-waypoint visibility for armyApproach, so this chaser never enters that recovery check. The next implementation experiment should validate cached path waypoints for ordinary chase too; this is a concrete motion issue independent of budget increases or stats.
