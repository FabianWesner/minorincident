# pre-uat-l6 — PO pre-UAT pass

**Bounded review and required checks complete. UAT recommendation: HOLD.** Baseline `f4bba5cf`; final product source `db0f6985`. Review window: 2026-11-07 22:05–2026-11-08 00:31 UTC, within the 3h time box. Five product defects fixed in separate commits. No targets, accepted L1/L2/L4/L5 tuning, reference assets, or specs changed. Nothing pushed or deployed.

## Findings and fixes

No P1 established in this pass.

| Severity | Finding and cause | Fix / before → after | Commit |
|---|---|---|---|
| P2, fixed | Offscreen shelter patient's speech lay behind portrait/HP; clamping its anchor also squeezed it into narrow wrapping. | Stable bubble width and existing whole-box placement solver avoid fixed HUD panels. All three before/after originals opened at zoom 0.5/1/1.5; after bubbles measure 340×69.375px with zero overlap. DOM measurements are cached between layout changes. | `915056f5` |
| P2, fixed | Breach warnings disappeared during weapon audio: L6 bang inherited prop priority 40 versus weapon 100. Actual high route admitted only 6/8 warnings. | Only `l6.bang` gets priority 110. Production mapper/limiter replay with 12/28 occupied voices rejects before, admits after. Final physical low admits 10/10 warnings; high 8/8; no audio errors. No gain/cap change. This establishes admission, not subjective mix quality. | `7a611420` |
| P3, fixed | Blue browser selection persisted over HP, labels, objectives and result. HUD/mission HTML permitted selection. | Disable selection on both UI roots. Controlled actual Cmd+A A/B: 164 selected characters before, only separate debug pause glyph after. Four original zoom1/1.5 captures opened. Mouse drag alone did not reproduce the original trigger. | `399e583c` |
| P2, fixed | Courier could skirt Northgate stairs and walk below the raised street. Thin y3.75–3.9 collider left an accessible void; reveal disc then cut a huge orange circle through the road. | Fill street collider down to 0; mask non-climbable floor beside/between the two actual stair flights. Production capsule sweeps at both qualities: 6m under-street travel before → 0.645m stopped before the edge; correct raised landing still allows 6m. Seal-only exposed old fists navigation using that void; exact floor exclusions restore honest 253.45s fists-only completion, 3 deaths. Final whole physical low/high routes climb to body y4.62, with intact street. | `bce5d17e` |
| P3, fixed | Closing letterbox cropped portrait and minimap in the completed low route. | Hide gameplay HUD during L6 cinematic only. An actual-played-prefix physical exit replay on low/GL2 and the whole high/GPU replay show clean Northgate framing and readable caption; result and L7 HUD remain intact. Originals opened. | `db0f6985` |

Numeric review metadata was also refreshed (`3085cf6f`, final refresh in this report commit): L6-05/07 previously displayed FAIL despite passing native clauses because their review source digest was stale. This is an evidence correction, not a gameplay change or visual signoff.

### Before/after evidence

[One small comparison sheet](../../../test-results/pre-uat-l6/review-sheet.jpg) contains dialogue, browser selection, street and cinematic pairs. Its street after frame is explicitly a [physical exit leg from a native prefix](evidence/exit-leg-after.json); whole physical reruns below provide independent route confirmation. All sheet originals were opened separately.

- Dialogue: [before receipt](../../../test-results/pre-uat-l6/dialogue-before3/receipt.json), [after](../../../test-results/pre-uat-l6/dialogue-after/receipt.json).
- Breach audio: [before](evidence/audio-priority-before.json), [after](evidence/audio-priority-after.json).
- Selection: [physical keyboard A/B](../../../test-results/pre-uat-l6/selection-keyboard-ab/receipt.json).
- Street: [capsules before](evidence/exit-support-before.json), [after](evidence/exit-support-after.json), [seal-only fists failure](evidence/fists-sealed-only.json), [corrected fists route](evidence/fists-corrected-route.json).
- Cinematic: [after replay](evidence/cinematic-hud-after.json).
- [Capture review manifest](capture-review.json): SHA256, path and concrete visual description for every relied original. Unreviewed captures in raw folders are not acceptance evidence.

## Coverage and method

Actual menu Start → L6 → Begin, real keyboard/mouse input, headless browsers; Mac GL2 uses Metal. No injected InputFrames, health writes, objective skips or actor moves during full routes. The production completion planner supplies read-only map/threat recommendations; native driver remains detached. Full custom routes use stepped clocks, so their durations are simulation time and provide no frame-rate verdict. Separate normal-RAF sampling is reported below.

| Coverage | Evidence / observation |
|---|---|
| Fresh browser storage, low/GL2, female | Normal-RAF mortal playtest completed 394.67sim/420wall seconds,8deaths,2out/29/27lost,0 console/page errors. Its2736 attacks all used MG despite owning other weapons; poor results are not a competent-balance verdict. Fixed uncollected headlamp ring stays at shelter. [Raw summary](../../../test-results/playtest/pre-uat-l6-fresh-low-gl/summary.json). |
| Progressed preset, high/WebGPU, male, before fixes | Whole physical route 437.85s,2deaths,10out/29/19lost, actual L7 roster10;0 errors. [Summary](evidence/physical-high-before.json). |
| Final low/WebGL2, female | Whole physical route 413.4s,2deaths,11out/29/18lost; all three gates closed,10/10 bang voices admitted, actual L7 roster11;0 errors. Source `bce5d17e` (before cinematic-only fix). [Summary](evidence/physical-low-final.json). |
| Final high/WebGPU, male | Whole physical route 379.52s,1death,1out/29/28lost; all three gates closed,8/8 bang voices admitted, actual Continue enters L7 with roster1;0 errors. Source `db0f6985`. [Summary](evidence/physical-high-final.json). |
| Gear 0–4, both couriers, low/high, zoom1/1.5 | All 40 required GL2 originals opened. Physical headlamp approach; whole bodies, hands/guns, shoes and companion equipment. No detached part established. [Matrix receipt](../../../test-results/pre-uat-l6/all-gear-gl/receipt.json). |
| GPU/GL2 spots and opposing movement/aim | Gear0 femaleGL2 and maleGPU low/high/zoom1/1.5 originals plus opposing D+LMB frames opened; gear 4 matrix opposing frames also opened. Beam versus movement normalized dot≈−0.999996: follows aim while walking opposite. Close male low/high/opposed originals show broad cap/band attached above eyes, not a detached lamp. |
| Route/presentation | Personally opened shelter, fight, retreat, all three closed-gate, stairs, closing shot, result and L7 originals. Gate rings/markers remain at service crossings; result out/start/lost counts match actual escaped roster, rather than cumulative pickups. Night shot frames Northgate/road/props; arrival truck is lit. |

**Fixture limits:** “Fresh” means fresh browser storage using the authored L6 baseline selection, not a naturally earned L1→L6 campaign. Progressed tests use a valid completed-five-level preset. Gear 0–4 are appearance-only selections made before trial input on that preset; campaign validation otherwise requires 10 upgrades. No full baseline-versus-PROD matrix or human balance signoff is claimed. The shared dialogue/CSS changes have L6 visual proof; this pass does not requalify presentation across all other levels.

Harness failures are preserved but excluded as product evidence: a held E across respawn prevented gate interaction; coarse 500ms aim updates lost targets; a direct-vector exit diagnostic aimed between stair flights. Replays use tap E, 150ms moving/firing updates and read-only floor navigation. Another high replay completed L6 but its L7 load overlapped our rebuild and lost required assets; it is excluded in favor of the clean final replay. These are not reported as game softlocks. [Held-input rejection](evidence/rejected-held-interact.json).

## Final checks

Checks ran through `tools/remote/run.sh` because shared Mac load exceeded 6.

- `npm run qa:accept -- --level L6 --skip-browser`: generated all 8 final-source receipts. After refreshing numeric-review evidence, `--reuse` reports **0 fresh failing L6 rows; 9 incomplete rows** (exit1). PASS: L6-03/05/07/10/13. Both tiers' fists maneuver completes 253.45s with 3 deaths, only fists/kick, ending on the raised street; 14 checkpoint cases PASS with identical controls. [Source/hash summary](evidence/acceptance-final.json), [L6 report](../fix51-verify/L6.json), [tracker](../../qa/acceptance-status.md). The first report build stops on replaced receipt hashes; the refreshed reuse is the final result. Unselected tracker rows and global summaries are preserved.
- `npm run qa:threat -- --levels L6 --maxWorkers=2`: completed 22.84s (30.5s including registry collection). Skilled completes 305.72s, passive reaches 110s cap; **0 L6 skilled/passive flags**. Exit1 is solely `PARTIAL_LEVEL_SELECTION`; this is an L6 diagnostic, not the full campaign gate. Registry 150/150 cases, 43/45 files. Harness revision metadata defaults to `manifest-only`; that provenance limit is retained in [summary](evidence/threat-final.json).
- Final QA build passed. Final source `npm run verify -- E24`: **PASS**. Typecheck 44.67s, lint 30.68s, `npm test` 77.18s; 106 tests passed, 1 platform skip, 27 files. Registry 150/150 cases, 43/45 files; test budget collection plus run 76.99s, below 150s. Vitest workers capped at 4. [Verification summary](evidence/verification-final.json). The first watchdog expires during exclusive-slot waiting, before validation starts; the successful retry starts its 300s validation timeout after slot acquisition. [Initial terminal status](../../../test-results/pre-uat-l6/gate-db0-final/status.txt).

## Still open

| Severity | Item | Evidence / next action |
|---|---|---|
| P2, unqualified performance risk | Real-clock spot recorded frames over200ms. | 20s each quality, actual WASD+LMB, WebGPU: low 2 hitches/max583.3ms, high 3/max366.7ms; p50≈16.7/p95≈16.8ms both. Shared load≈21 prevents attributing CPU/GPU contention or qualifying a quiet performance pass. [Measured summary](evidence/shared-load-frame-spot.json). Repeat isolated with a trace; no speculative tuning applied. |
| P2, acceptance coverage | Formal visual/browser/manual criteria remain incomplete; L6-14 visual review is stale. | This capture pass does not rewrite every criterion or turn skipped browser checks into passes. The native fixtures also reproduce the inherited global G-24 enemy-bar eligibility failure; it is not newly introduced by this lane. See final native check result and tracker. |
| P3, visual taste | Shelter/tunnel faces remain subdued at distance; male headlamp cap/band looks broad; lit stair noses are very white. | Low/high and close/opposing originals opened. Bodies separate and accessories stay attached; no missing-body/whiteout defect established. Art direction follow-up, no unproven model/light edits. |
| P3, observation limit | Subjective audio mix and competent-human escort balance remain unsigned. | Warning voice admission is proven; listening quality is not. Physical routes suffer substantial casualties. No uniquely slow injured follower was established; do not claim that criterion passed. |

## Verdict

**Is it stunning?** The warm shelter against the dark tunnel, lantern pools, crowd under the service arches and quiet Northgate night reveal have strong moments. Repeated tunnel crossings and subdued faces keep the whole level short of a uniformly stunning verdict.

**Boring / harmless?** No: real routes encounter active attackers, player damage/deaths and substantial survivor loss. Native reachability/pressure measurements support that observation; automation's losses cannot establish correct difficulty for a competent player.

**Babysitting?** Staying with and defending the crowd is demanding. No distinct injured straggler was demonstrated, but this is not a human signoff that escort pacing feels good. Rescue rate remains free per the PO; no accepted balance targets changed.

**UAT: HOLD**, pending the open acceptance/visual evidence and isolated performance follow-up. The bounded pre-UAT pass fixes the five demonstrated defects and preserves those limits explicitly.

All lane checks and browser runs are terminal. Final source/hash, numeric-review freshness, evidence SHA256 and `git diff --check` were rechecked before the report commit. Remaining items above are explicit follow-ups; no formal UAT GO is claimed.
