# E27 closure audit

Audited main / initial lane HEAD `baf1fb5a3848c18d1ad34cb8ce1c0fcc715c0f97` before implementation, 2026-10-10. A test tag alone is not a PASS: existing evidence and fresh validation are distinguished below. No performance or capacity budgets changed. AC14’s conflicting recovery wording was corrected, as documented below.

| AC | Initial audit | Evidence / missing behavior |
| --- | --- | --- |
| E27-AC01 | PASS (test exists) | tests/unit/data/explosions.test.ts; rerun pending. |
| E27-AC02 | PARTIAL | tests/sim/explosions.test.ts covers small/medium/large/mega, one-tick upward impulse and cover; incendiary/toxic class evidence incomplete. |
| E27-AC03 | PASS (test exists) | tests/e2e/explosions.spec.ts fixed-tick seven-beat pixel detectors; fresh run/captures pending. |
| E27-AC04 | PASS (test exists) | tests/sim/explosions.test.ts five-tank sequence and 14-tank cap; rerun pending. |
| E27-AC05 | PASS (test exists) | tests/sim/explosions.test.ts and tests/e2e/explosions.spec.ts cover body lift, parts, wreck and 20 s smoke; rerun pending. |
| E27-AC06 | PARTIAL | Gas-station test covers kill ratio/proximity; fuel-truck data and E22 test exist but five-second town tint and disabled-setting proof missing. |
| E27-AC07 | PASS (test exists) | tests/e2e/explosions.spec.ts per-frame reduced-flash pixels; rerun pending. |
| E27-AC08 | PASS (test exists) | tests/sim/explosions.test.ts target loss, wander and exact 720-tick lifetime; browser cloud test; rerun pending. |
| E27-AC09 | GAP | Skipped placeholder; unused gas variants staged to release extras in 04 §6. |
| E27-AC10 | GAP | Skipped placeholder; extinguisher burst absent. |
| E27-AC11 | GAP | Night fire light test proves brighter scene, not lower-third hue/brightness or siren phase. |
| E27-AC12 | GAP | Shared see-through hole dims puffs; no measured smoke/player contrast and opacity proof. |
| E27-AC13 | GAP | Stale placeholder says L6; current criterion requires L5 pair-plaza columns/shadow strips and is NOT deferred to E24. |
| E27-AC14 | PARTIAL | tests/e2e/explosions.spec.ts pool/cap recovery and tests/perf/explosions.spec.ts; rerun pending. |
| E27-AC15 | GAP | Skipped review placeholder; Scene Lab effects exist, required checklist H/collapse review absent. |

## Validation

Pending. Epic remains in-progress until all non-deferred criteria have evidence.

## Implementation in this lane

- Added the missing toxic definition/preset, using the shared hazard resolver; gas lifetime and damage stay on the fixed sim clock.
- Added tear-gas zones and applied existing `Status.speed()` to normal agent motion (impulses retain their existing response).
- Added one-shot extinguisher bullet/melee triggers: 3 m fire-zone cleanup, forward 90° infected stun for exactly 60 ticks.
- Fire/blast transients now render in daylight independently of practical lamps, and clear the field after expiry. Persistent fire emits embers through the existing particle pool at 4 Hz high / 2 Hz low.
- Smoke samples the existing HDR light field; toxic clouds are green, tear gas neutral. Player-ray smoke uses ordered 30% dither coverage; postprocessing coverage remains below the required 40% cap.
- Persistent large fires emit taller columns; pooled soft directional ground strips use the existing sun/moon direction. No new render technology, dependencies, budgets, or L6 mission/data changes.
- Added reproducible Scene Lab capture tooling and quantitative AC11/12/13 checks. Extended curve/flash checks to all six classes, the mega sim test to both sequencers, and perf stress to include the fuel-truck mega.

Focused remote simulation run: 12 passed, two pre-existing vision placeholders skipped (not counted as acceptance evidence); `closure/final-focused.json`. Later added the toxic-hazard lifetime test; included in the final gate. Typecheck/lint passed after these changes. Final browser/performance/vision evidence follows below.

## Scene Lab effect review (headless WebGL2, inspected 2026-10-10)

All 22 scene runners passed console-error checks. Sheets sample every 60 ticks (15 for the extinguisher, 30 for the car); blast scenes also capture 0/2/6/15/40/180/900 individually. Sheets alone cannot establish the short flash/fireball timing; AC03 pixel detectors provide that proof.

| Effect | Inspected sheet | Observation |
| --- | --- | --- |
| small | scene-lab/blast-small/sheet.jpg | Short sparse gray column dissipates; a persistent circular char mark remains. |
| medium | scene-lab/blast-medium/sheet.jpg | Several flame patches, glowing orange lower smoke, gray upward drift; purple ground strip follows the light direction. |
| large | scene-lab/blast-large/sheet.jpg | Larger aftermath with more flames and a thicker column; char footprint is distinct. |
| mega | scene-lab/blast-mega/sheet.jpg | Staged orange fireballs and expanding dust ring; broad aftermath, multiple columns, tinted ground shadows. |
| incendiary | scene-lab/blast-incendiary/sheet.jpg | Brief smoke and scorch in the direct-definition fixture. The gameplay Molotov's actual fire-zone aftermath is exercised in weapon tests. |
| toxic blast | scene-lab/blast-toxic/sheet.jpg | Green expanding cloud differs clearly from gray smoke; legacy square ground patch was replaced by a soft radial footprint; corrected capture inspected. |
| car wreck | scene-lab/car-wreck/sheet.jpg | Smoking/burning tell, body lift, orange fireball, detached black panels and persistent burned wreck. |
| building fire at night | scene-lab/building-fire-night/sheet.jpg | Flame tongues and warm ground spill against cool night; smoke rises above the house, orange at its base, gray higher up. |
| toxic hazard | scene-lab/toxic/sheet.jpg | Green clouds read as gas; corrected soft ground footprint inspected. |
| tear gas | scene-lab/tear-gas/sheet.jpg | Low neutral gray/white puffs; player-facing portion is dithered. |
| extinguisher | scene-lab/extinguisher/sheet.jpg | Flames stop after the shot; a brief pale burst disperses, leaving clear ground. |
| smoke grenade | scene-lab/smoke-grenade/sheet.jpg | Dense rounded cloud with a visible courier through the dithered region. Scene Lab's attack-target latch now cancels at the requested end; corrected recapture inspected. The emitter stops and its last puffs fade out rather than another grenade being thrown. Exact twelve-second lifetime already passes the sim/browser grenade tests. |

The first L4 collapse photo was also inspected: full-screen flash makes this peak frame pale, with a small bright blast visible behind the foreground buildings. This single frame does not establish the required complete checklist H review. AC15 remains open until production collapse framing and all checklist items are proven.

First new visual measurements: fire-column lower hue 21.18°, lower/top brightness 2.97× (passes those portions of AC11). Player contrast 1.281:1 and measured smoke coverage 47.91% (fails AC12). The smoke base shader was still daylight-bright at night; it now consumes the shared lighting intensity before fire/practical radiance is added. The siren sample accidentally retained `vfx: false` from its background capture; fixed setup explicitly enables it before reload. The corrected shader and paired-background siren fixture now pass: lower hue 24.08°, lower/top luminance 13.72×, player contrast 2.241:1, measured coverage 39.12%. Final production verifier is queued.

## Performance before / after

Both runs used headless Chrome with Metal WebGL2, one worker and the quiet-run reservation of both browser slots. Phone profiles use the existing 4× CPU throttle and existing DPR. No budget or effect was removed. Before: 10/10 existing L1–L5 checks. The table below records the earlier E27-only implementation (14/14); the final combined E25-core performance rerun is pending. An intermediate combined run failed L3 phone fallback (66.6 ms, 58.5 ms on repeat; unchanged limit 50 ms), retained in E25 closure/perf-failed. Raw evidence: E25 `closure/perf-before/` and `closure/perf-after/`; conditions in `closure/perf-conditions.jsonl (before) and closure/perf-final-conditions.jsonl (final after)`. High asserts p95 ≤14 ms; phone uses its existing p50 ≥30 fps proxy, with p95 also reported.

| Level / spot | Tier | Before p50 / p95 ms | After p50 / p95 ms | Result |
| --- | --- | --- | --- | --- |
| L2 peak | high | 7.0 / 9.2 | 6.6 / 8.9 | PASS |
| L2 peak | low | 25.7 / 31.3 | 21.3 / 27.1 | PASS |
| L3 attack | high | 4.9 / 7.3 | 4.9 / 7.4 | PASS |
| L3 boulevard | high | 5.0 / 8.0 | 5.0 / 8.1 | PASS |
| L3 street | high | 6.2 / 8.7 | 6.1 / 8.8 | PASS |
| L3 attack | low | 17.0 / 34.0 | 17.5 / 34.4 | PASS |
| L3 boulevard | low | 16.5 / 34.1 | 16.8 / 33.8 | PASS |
| L3 street | low | 18.7 / 34.3 | 22.6 / 31.5 | PASS |
| L4 war | high | 5.4 / 7.3 | 5.6 / 7.5 | PASS |
| L4 collapse | high | 8.1 / 9.8 | 7.1 / 9.2 | PASS |
| L4 war | low | 19.0 / 34.4 | 15.6 / 32.4 | PASS |
| L4 collapse | low | 20.5 / 33.6 | 20.2 / 34.5 | PASS |
| L5 group walk | high | 5.1 / 7.7 | 5.2 / 7.8 | PASS |
| L5 group walk | low | 13.5 / 19.3 | 13.7 / 19.1 | PASS |

L1 is the existing structural photo-spot gate; it does not assert frame percentiles.

| L1 | Before max draws / triangles | After max draws / triangles | Result |
| --- | --- | --- | --- |
| high | 112 / 802,451 | 112 / 802,451 | PASS |
| low | 90 / 321,149 | 90 / 321,149 | PASS |

Earlier E27-only full unit/sim gate: **911 passed, 0 failed**, 221 reported suites green; 9 pending entries are the explicitly excluded long batteries. Filter: `^(?!.*(?:20 seeds|20-seed|battery|T-E05-encounter|T-E08-11|T-E19-06))`. The three extra exact IDs identify unlabelled long encounter/patrol/20-seed spread batteries from their source. No acceptance tests were weakened or newly skipped. Evidence: E25 `closure/unit-sim-final.json` and `.log`; remote runner exited 0. Latest typecheck and lint passed. Main merged again: already up to date at `baf1fb5a`. Final browser/performance gate is queued.

## Level-suite investigation

The first final level run returned **22 passed, 2 failed** (L1 unassisted bicycle travel and L2 unassisted escape). A targeted L1 repeat returned one pass and one failure; no assertion was weakened. Detached unchanged main reproduced the **same L2 escape failure at exactly the same transform** (-46.4671, -37.9352), with 3/4 targeted repetitions passing. Evidence: E27 `closure/main-baseline/results.json`, `L2-error-context.md`, `closure/main-levels.log`, `levels-final.log`, `l1-diagnostic.log`. The temporary detached worktree was removed.

L2's helper restored the follow camera before InputSystem consumed the queued screen click. It now steps one real sim tick under the projecting camera, matching the existing L1/L3 helper; the destination and gameplay assertions remain unchanged. The full production level rerun passed **24/24** (14.2 minutes), including both previously failing routes; `E27/closure/levels-final.json` and `levels-rerun.log`. L1's extra lastPick diagnostic is retained to expose future failures.

## Criterion correction: AC14

The original “all pools baseline 30 s after the last blast” contradicts the authored 45-second mega fires and smoke emitters (`src/data/explosions.ts`) and persistent wreck aftermath in this epic. The existing browser test waited an arbitrary 120 seconds, so it did not prove that wording. AC14 now distinguishes expired flash/fireball/debris instances from bounded smoke/fire/wreck aftermath, then requires transient particle/smoke/debris pools to recover within the same 30-second window after the final source ends; persistent scorch remains as required by AC03. No particle/debris/frame budget, fire lifetime, emission rate, or effect was reduced or removed for this correction. The browser check samples the last-blast +30-second state and steps exactly to final-source expiry +1800 ticks; `ac14-budgets.json` records both timestamps and states.

## Current integration gate (2026-10-10)

Implementation is committed through `78e39cbf` (production source `100207ee`), following the merge of main `98e9aa79`. Closure remains **in progress** until the fresh combined gate is green.

- Full remote unit/simulation suite: **962 passed, 0 failed**, three long batteries excluded. Raw results: E25 `closure/unit-sim-final.json` and `.log`.
- Typecheck, lint and build passed during the current E25 verification; selected remote E25 suite: **28 passed**. Browser stages are queued.
- Fresh full level suite: **29 passed, 2 failed**, no skips. Oak repeats the same travel stall; L6 completes with 27 rescued and no deaths but fails its straggler-rejoined assertion. Evidence and the short exact-position simulation probe: E27 `closure/levels-oak-repeat/README.md`.
- Fresh Scene Lab captures and final combined L1–L5 performance checks remain pending. Earlier passing captures/performance are historical evidence, not the final gate.

No budgets, level arrival tolerances, mission data or assertions were weakened. E25/E27 status remains `in-progress`.
