# L7 bus departure P0 · 2026-10-20

PO on PROD: “Checkpoint not working”, “I cannot finish this level.” Courier at `l7-bus-boarding`, corridor checkpoint, tick 32165, 1.3 m from the marker. Base: `82604a125`; L5 reference fix `6432c7c69` was read.

## Root cause and fix

The courier correctly starts boarding within 6 m of the marker. The bus requires every `following` survivor, but only claimed survivors within 14 m of its door. Formation offsets could leave followers outside that radius, and blocked paths or congested approaches could hold any living follower indefinitely. There was no recovery or HUD explanation.

Boarding now routes the entire living roster directly to its queue slots. After 20 seconds without 0.5 m net approach progress, a survivor uses a hidden transition to a clearance checked queue position, following the existing L5 corgi relocation pattern. It then crosses the ordinary door for 36 ticks, with the existing 15 tick entry spacing, before counting aboard. Identity and health are retained; `l7.survivor-recovered` records the assist. No roster member is scripted dead or deleted.

The existing objective panel shows `Aboard n/m`, `Waiting for <name> · <distance> m` for the nearest missing survivor (distance to the door), and `Everyone aboard` for one second before the shot. L5 names and Marcus (`shelter-0`) are preserved; unnamed residents use numbered survivor labels. Existing combat/infection losses leave the living denominator through ordinary roster rules.

Leaving the existing 16 m radius pauses boarding and clears stall timers. Stall and confirmation times serialize and rebase with checkpoint seams; old snapshots without the new fields remain supported.

**Spec choice:** E29 §5.3 / AC13 require every living group member to board. Recovery to the queue satisfies that goal. The proposed 45 second departure leaving living survivors behind was not selected. The user explicitly authorized hidden relocation after 20 seconds of stalled progress; this is the narrow recovery exception to E29's general no teleport/no visible jump rule. No specifications, bot logic, tick budgets, test timeouts or goal conditions were changed.

## Reproduction and focused validation

- **Original production build, real input:** restored corridor checkpoint, mouse click then held W+A to the ring. Courier ended 0.84 m from the marker. After **100 sim seconds**, only **19/24** aboard; still `boarding`; the trapped survivor remained **39.4 m** from the door. HUD gave no count/wait cue. Evidence: `test-results/p0-l7-departure/before/high-report.json`, `before/e2e.log`.
- **Original-code sim reproduction:** both high/low cases remain `boarding` at the **3600 tick** guard, producing **2 expected failures**. Original departure/config source was copied into a private remote job; lane source stayed fixed. Evidence: `before/sim.log`.
- **Final production build, new real-input e2e:** **2/2 pass**, **32.1 s wall time**. High boards **24/24 in 32 sim seconds** from arrival at the ring; low boards **15/15 in 21 seconds**. Both hand over automatically to L8; waiting/count/visible confirmation assertions and console/request guard pass. High shows `Waiting for Marcus · 13 m`. Headless Chromium, ANGLE/Metal, one browser/worker, ports 3851/3852, through `tools/e2e-lock.sh` with a 30 minute admission cap. Evidence: `{high,low}-report.json`, `playwright.json`, `e2e.log` in `test-results/p0-l7-departure/`.
- **New stuck-follower level tests:** both quality settings board **24/24** and finish in **1837 ticks / 30.617 sim seconds**, preserving every living identity with zero occupancy failures. They exercise production save/resume during boarding.
- **E29 remote selection:** **112 passed, 0 failed**, 32 passing files. Includes departure/encounter simulations, all five L7 checkpoint tests and the unchanged standalone completion audit. Two additional untagged queue regressions pass separately; the final Marcus/name/loss-count assertion also passes. Evidence: `test-results/epics/E29/vitest.json`, `queue-regressions.json`, `names.json`.
- **Standalone L7 result:** complete in **502.817 sim seconds / 30,169 ticks**, **22/24** starting survivors escaped, zero courier deaths, no blocker. Existing cap: **72,000 ticks**. Evidence: `test-results/spec-audit-c/l7-standalone.json`.
- `npm run typecheck`, `npm run lint`, fresh production build: pass.

The fixture clears combat during setup and encloses one follower with physical/navigation blockers. After checkpoint restore all courier motion uses DOM mouse/keyboard input, with no logical input injection, teleport or departure-objective cheat during the attempt. The existing full Northgate→rocket→horde→bus→L8 real-input test also passed in the broader matrix.

## Campaign tick-budget gates

Both unchanged continuous seed-1 gates passed in the full four-worker suite and in a targeted two-worker run (**2/2**, **590.50 s wall time**). Normal handovers, loadout/roster identity assertions and no-cheat checks pass; L10 reaches credits.

| Level | Sim seconds | Ticks used | Existing cap | Courier deaths |
| --- | ---: | ---: | ---: | ---: |
| L7 | 484.750 | 29,085 | 72,000 | 0 |
| L9 | 127.733 | 7,664 | 72,000 | 0 |
| L10 | 1570.400 | 94,224 | 216,000 | 0 |

L7 receives 28 L6 survivors and carries 26 into L8 after ordinary gameplay losses. Every living follower boards; exact handover identity checks pass. Evidence: `test-results/p0-l7-departure/campaign-gates.json`, `test-results/epics/E31/campaign-seed-1.json`, `test-results/epics/E32/Q4/campaign-seed-1.json`.

## Broad validation limits

The requested remote `tests/unit tests/levels --maxWorkers=4` run finished in **4922.69 s**: **2142 passed, 3 failed, 11 skipped** across 393 files (387 passed, 3 failed, 3 skipped). All three failures are wall-clock timeouts; all three pass separately at their unchanged limits:

| Test | Full-run wall seconds | Limit | Passing run seconds |
| --- | ---: | ---: | ---: |
| L7 standalone audit | 314.476 | 300 | 136.569 (E29 selection, one worker) |
| Typecheck/lint/build static check | 201.919 | 180 | 115.32 (one worker, total run) |
| Production asset inventory validator | 300.022 | 300 | 210.85 (one worker, total run) |

The timed-out full-run L7 audit still wrote a successful gameplay result within its tick budget. Concurrency/resource pressure is the supported explanation for these wall-clock failures. Evidence: `test-results/p0-l7-departure/{vitest,static,assets}.json`, `unit-levels.log`.

`npm run verify -- E29` has **112 passing remote tests**, then **43 passing / 14 failing browser checks**. The failures are existing visual fixtures/measurements outside departure:

- Two `l7-pairs.spec.ts` cases read missing `pair-*` anchors from the raw D-FAIR layout, unchanged from base `82604a125`.
- Twelve `l7-night.spec.ts` cases get zero courier ID-mask pixels at the horde spot (-48,46), making `clipped / pixels` NaN. The normal capture shows the courier; its ID mask is empty. Departure is inactive there, outside its trigger. Rendering and those fixtures were not changed.

The verification script stops at those browser failures, so its native performance stage was not reached. No thresholds or goldens were relaxed. Evidence: `test-results/p0-l7-departure/verify-{playwright,checks}.json`, `verify.log`, `verify-run/`.

Remote admission was delayed by saturated runners and provider capacity/IP limits. A stale Git index lock in this lane's copied runner cache was removed after its process exited. No repository tooling changes were needed.

## Captures inspected

Under `test-results/p0-l7-departure/`:

- `before/high-2-wait.png`: courier visibly at the ring, objective says 1 m, no explanation of the wait.
- `high-1-ring.png`: final build names Marcus and displays the boarding count.
- `high-2-wait.png`, `low-2-wait.png`: count/name/distance wrap legibly inside the existing objective panel.
- `high-3-everyone.png`: visible `Aboard 24/24 · Everyone aboard` before the cinematic hides the HUD.
- `high-4-L8.png`, `low-4-L8.png`: zoo arrival with the carried group and normal L8 briefing.

Also inspected `test-results/epics/E29/night-high-webgl2-z1/{rocket-mask,horde-mask,horde}.png`: rocket mask has 7383 courier pixels and 4.587 contrast; horde mask has zero courier pixels despite the courier being visible in the normal capture. This explains the contrast NaN failures.
