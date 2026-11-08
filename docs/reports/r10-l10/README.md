# r10-l10 — L10 forecourts, persistent fires, crossing stories

Baseline: `0ad5a72b`. Final game change: `8f496a92`; subsequent commits contain QA helpers. Changes are committed separately. No other level, spec, reference art, asset file, or dependency changed. No deploy or push.

## Changes

- R6 and the console approach now have 596 paving panels, 77 broken kerb strips, 47 shallow puddles, and scattered lit supplies/debris. The procedural ground adds 8,499 triangles across the whole approximately 1 km stretch, using existing spatial instancing/materials. Ground dressing is visual only. Eight existing generator props use their existing physics-only colliders and are checked against encounter slots and decor clearances.
- Three fixed crossing stories: R4 tank command post (five pieces), R4 burning-bus evacuation blockade (four), and R6 far-bank tent/ambulance triage (four). Existing fitting checks preserve road, walking-line and spawn clearances.
- The L10 fire renderer refreshes visible ambient car fires when the camera changes and invalidates that cache after warmup reset. First-visible flames and smoke are seeded immediately. Flame and smoke caps remain **128 flames, 120 low / 400 high smoke puffs**. Other districts retain their existing path.

## Visual review and real input

[Before/after comparison](../../../test-results/r10-l10/before-after.jpg): police first frame, R6 forecourt, console approach; low, zoom 1. This is the one retained image sheet. Reviewed raw captures were deleted at the orchestrator's disk-space request; their findings and source hashes are retained in the [audit summary](../../../test-results/r10-l10/review-summary.json) and [build identities](../../../test-results/r10-l10/builds.json).

Opened all 14 matched sheets (seven locations × before/after), covering 56 views across low/high and zoom 1/1.5. R6 shows slab seams, broken edges, shallow dark puddles and warm supplies replacing the plain blue ground. Paving and lamps continue into the final console approach. Command, evacuation and triage have distinct tank, bus and medical silhouettes. The far-bank triage arrangement leaves the courier clear; zoom 1.5 shows the complete composition more readily than zoom 1. No z-fighting was visible in these views.

The baseline police-car first frame had no flame; its next rendered frame did. The final isolated scene has six flame cards in **61/61 rendered frames on both tiers**, with smoke present from frame zero (two initial puffs; later 4–5 low / 4–9 high). Opened first/late frames show orange flames and ground glow; smoke is subtler. The fix addresses camera/paused-frame initialization without increasing VFX pools.

The production `tools/playtest` driver used physical keyboard/mouse input, a versioned corridor save, god mode, WebGL2, headless Metal, and the pinned final build for all four tier/zoom combinations. Each initial sample ran approximately 300 wall seconds and 291–294 simulation seconds. The driver yielded at the time limit without completing the campaign. Selected real-input captures were opened individually: R6 slabs and lights remain readable during movement; the approach shows puddles, lit crates, pallets and debris. Two explosion-obscured views were treated as limited ground evidence. Low zoom 1.5 reached the console activation checkpoint; both high-tier resumes reached active console defence (25–28 seconds charged), covering the remaining console distance. Route details are recorded in the [selected-input audit](../../../test-results/r10-l10/real-selected.json).

## Empty-stretch measurement

`tools/qa/r9-l10pace-empty.ts --decor-json` applies the same scenery rule to baseline and final snapshots on **the same 272-sample physical trace, zoom 1**. It counts tall crossing scenery and fires; the new low paving, puddles and supply lamps do not inflate this measure.

| Measure | Before | After |
|---|---:|---:|
| Longest no-scenery stretch | 47 s | 14 s |
| Longest no-scenery-and-no-enemy stretch | 22 s | 10 s |
| Total no-scenery-and-no-enemy seconds | 147 s | 138 s |

The former 47-second gap was the console installation approach (approximately x3788–3983). The remaining longest gap is earlier in the dispersal route (approximately x3047–3109). [Before meter](../../../test-results/r10-l10/empty-before.json), [same-trace after meter](../../../test-results/r10-l10/empty-after-same-trace.json). Reproduce with the [272 trace rows](../../../test-results/r10-l10/meter-trace.jsonl), [baseline decor](../../../test-results/r10-l10/before-decor.json), and [final decor](../../../test-results/r10-l10/after-decor.json).

## Checks

- Final `npm run typecheck` and `npm run lint`: PASS.
- Final `npm test -- --maxWorkers=4`: **107/107 PASS**, 27 files, 26.6 seconds. Case budget remains **150/150**; the existing world-systems case was extended, with no new case. Earlier loaded-host navigation/cohort timeouts were superseded by this final run.
- `qa:accept -- --level L10 --tier both --skip-browser`: both complete policies finish; stationary policies reach tick budget. Each tier passes 16 fixture clauses and 27 checkpoint clauses, controls identical, zero errors. Overall exit 1: one fresh failing row and ten incomplete rows. The military stationary count is two before and after (confirmed by a baseline native probe); historical composition/dog evidence remains stale. Generated tracked acceptance receipts were restored after recording this run.
- `qa:threat -- --levels L10`: **zero L10 flags**, skilled complete, passive tick budget. Exit 1 is the global `PARTIAL_LEVEL_SELECTION` diagnostic for selecting only L10.
- Full `scene:gate`: **50/50 PASS**, zero known failures, zero unrun rows; 17 minutes, final pinned build, WebGL2/WebGPU tiers. Opened the two L10 fixture sheets: the military road/courier and Mega approach render normally. Other rows are numerical regression evidence.
- Quiet native Metal WebGL2 timing and cold loads: **PASS**; details below. Existing assets, LODs and VFX caps are reused; no new downloads.

## Performance

Native Apple M4 / ANGLE Metal WebGL2, exclusive quiet admission (load <3, no foreign browser/build/test work). Each build covers low/high × zoom 1/1.5 × R4, R6, approach and console: sixteen 6.5-second physical WASD legs, approximately 29 m each, after the same 120-tick setup. God mode and cleared enemies isolate scenery cost; the separate production-driver matrix covers combat traversal. Counts use valid nonnegative rAF intervals.

| Movement metric | Before | Final |
|---|---:|---:|
| Valid frame intervals | 28,086 | 25,837 |
| Maximum frame interval | 18.8 ms | **24.8 ms** |
| Largest per-leg p95 | 5.2 ms | 5.8 ms |
| Frames over 66 ms | 0 | **0** |
| Maximum drawn triangles | 197,614 | 207,556 |
| Maximum draw calls | 96 | 102 |

Every leg retained its requested quality tier, stayed within that tier's draw/triangle limits and terrain residency limit (9 low / 25 high), and had no context loss. Final movement browser-error accumulators are empty for both tiers. Fresh-browser cold menu-click to Begin-ready loads:

| Tier | Before (one sample) | Final worst (three samples) |
|---|---:|---:|
| Low | 3.759 s | **3.876 s** |
| High | 3.641 s | **3.592 s** |

All cold observations use fresh browser profiles/caches, native hardware, the requested quality, no diagnostics, and zero browser errors. Largest post-card frame interval is 16.8 ms. [Compact performance audit](../../../test-results/r10-l10/performance-summary.json) contains every leg, cold sample, admission condition, renderer and budget.

The first reservation spent most of its ten-minute cap waiting for unrelated CPU work. Its sixteen completed baseline movement legs were retained; cold loads resumed in the next quiet reservation. No incomplete sample was counted. All checks have exited. Reviewed raw captures, receipts, profiles and both derived builds were deleted at the orchestrator's disk-space request; only this README's linked audit inputs and the single comparison sheet remain.

## Reproduction

QA helpers: `tools/qa/r10-l10-visual.ts`, `r10-l10-route.ts`, `r10-l10-perf.ts`. Route helper can resume a production save using `R10_RESUME_FILE`; it uses the central shared browser pool. Frame timing requires `tools/perf/quiet-run.sh`. At most two lane contexts run concurrently; no server uses port 3300. `R10_PERF_SIDE=before|after` splits timing by build; `R10_PERF_COLD_ONLY=1` resumes cold loads after all movement legs exist. Regenerate the two pinned QA builds before replaying browser helpers.
