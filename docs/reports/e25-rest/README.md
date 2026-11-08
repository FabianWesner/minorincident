# E25 remaining acceptance checks — 2026-11-08

**AC01 and AC04 measured; AC06 repaired. E25 cannot be set done.** Starting revision: `63814503`. The remaining epic gaps are AC09, AC10, AC13, AC14 and AC16; this lane does not change their thresholds or status flags. All scoped measurements and native-view comparisons are complete; validation receipts and the existing smoke failure are recorded below.

## Per-AC result

“Prior” refers to the current merged [verification report](../e25-verify/README.md) or [emitter report](../e25-emitters/README.md), not a fresh full-epic retest in this lane. The table distinguishes those results from the new measurements. With the three scoped checks closed, the evidence tally is **11 met / 3 red / 2 incomplete**; the epic remains open.

| Criterion | Result | Evidence / remaining requirement |
| --- | --- | --- |
| AC01 — spike | **Measured; decision recorded** | [Lighting and tone spike](spike.md): paired native WebGPU DynamicLighting/ClusteredLighting cases at 16 and 256 lights, counters, timestamps and screenshots; shipping/ACES/AgX controls. Retain the universal field, selected hero shadows and shipping tone curve. The code follows that decision. |
| AC02 — anchors | **Met, prior** | Merged emitter inventory: 1,823 exports, zero missing emitter references and zero uncovered emissive meshes. This lane changes no assets. |
| AC03 — pool / fence | **Met, prior** | Prior high/low ratios 50.94×/51.08×; behind-fence ≤1.3× ambient. The new scoped captures retain the fixed pool masks; tint changes only occluded practical lighting. |
| AC04 — backend parity | **Met, fresh high and low** | Same pose and 376-point pool mask on actual WebGL2 and WebGPU. Maximum paired mean-luminance difference **0.06246%**, including zoom 1 and 1.5; limit ±10%. [Receipt](evidence/paired-masks.json). |
| AC05 — heroes / crossfade | **Met, fresh regression high and low** | Corrected QA build: 60 s, 40 lamps, 119.95 m; max 1 light / 1 map, 1 selection change/s, 0.300–0.317 s completion sampling; maximum pool-centre frame delta 8.235% high / 8.263% low. [Receipt](evidence/walk.json). |
| AC06 — shadow tint | **Met, fresh high and low on both backends** | Hue **256.57–256.68°**, behind/beside darkness **73.21–74.43%** across both zooms; limits 230–290° and ≥35%. Fixed geometric mask and same-frame no-caster control. [Before/after sheet](../../../test-results/epics/E25/rest/shadow-before-after.png), [receipt](evidence/paired-masks.json). |
| AC07 — generator | **Met, prior** | Interaction/power/flicker and next-frame off-state evidence in the prior simulation/render audit. |
| AC08 — breakage / sight | **Met, prior** | One pistol hit breaks the lamp; sight threshold 16.0→9.6 m (40%). |
| AC09 — beam edge | **Red, prior** | Raw-image maximum adjacent gradient 33.46% exceeds 25%. Beam-isolated diagnostic does not waive the written full-image threshold. |
| AC10 — reflections | **Red, prior** | High-tier SSR is absent; dry-neighbor and reflected-car ID-pass proof remains missing. |
| AC11 — materials | **Met, prior WebGL2 high** | Camera-dependent gloss highlight, matte and metal controls recorded in the prior report. |
| AC12 — window depth / power | **Met, prior high and low** | Measured parallax ≥4 px and powered/unpowered luminance ratios >9×. |
| AC13 — night readability | **Red, prior** | Courier contrast passes, but sampled infected bodies have brighter pixels than the eyes. Full archetype coverage remains incomplete. |
| AC14 — performance | **Incomplete** | Prior draw/triangle/heap counters pass; admitted native frame-p95 and complete lighting-pass budget proof remain absent. AC01 mechanism timestamps are not that level-budget proof. |
| AC15 — previews | **Met, prior** | 95/95 light-bearing assets, 190/190 nonblank day/night Blender previews; in-game night/on-off evidence. |
| AC16 — checklist G | **Incomplete** | Required named lighting targets are absent; `mall-floor` is unknown; the complete L6 progression/reference checklist remains unsigned. No target images were regenerated. |

## AC04 paired pool luminance

Same fixed light-lab scene, seed 1, 1280×720, DPR 1, identical camera and tick. Backend assertions reject fallback. Values are linear sRGB luminance from the same projected world mask, with no region adjusted between backends or tiers. Native GPU/Metal contexts came from the shared headless browser pool; this lane used no more than two contexts concurrently.

| Tier | Zoom | WebGL2 | WebGPU | Difference vs WebGL2 |
| --- | ---: | ---: | ---: | ---: |
| high | 1 | 0.55745739 | 0.55740597 | −0.00922% |
| high | 1.5 | 0.41559064 | 0.41585020 | +0.06246% |
| low | 1 | 0.55824542 | 0.55820478 | −0.00728% |
| low | 1.5 | 0.41541087 | 0.41566088 | +0.06018% |

The receipt also retains the pre-fix pair: its maximum difference is below 0.061%. This rules out a backend-specific explanation for the old hue failure.

## AC06 cause and repair

The failure reproduced exactly: high WebGL2 zoom 1 yielded hue **315.75486°**, mean caster-control darkness **55.762%**, and behind/beside darkness **48.135%**. The authored night shadow hue was already blue. The shader blended that dim blue bounce directly with the warm pool according to the PCF coverage. Consequently the partial-shadow pixels retained pink/magenta light even though the deepest shadow core was blue. An unchanged-mask diagnostic found 35–65% darkened samples at 296–344°, versus 65–85% darkened samples at 272–289°.

`PaletteMaterial` now separates penumbra hue from attenuation. It brings occluded pools toward the authored shadow hue while preserving peak channel strength and the fully shadowed bounce; fully lit pools retain their original color. The correction remains inside the existing `fieldShadow` weight, with no new pass, light, map, material variant or preset. A first luminance-normalized candidate passed the numeric hue check but made the blue channel too bright; it was rejected after image review. Its captures remain separate from the binding evidence.

At zoom 1 the qualified shadow samples increase from 60/75 to 73/75 because the same geometric penumbra is now darker. The 75-point geometric mask and ≥35% qualification rule are unchanged. Hue is measured from the actual beauty-frame RGB of those samples, not from a diagnostic tint or difference image. At zoom 1.5 the corrected hue is approximately 256.59°. Both backends and both tiers pass.

Visual review of the before/after light-lab frames: the courier and fence cast a darker purple-blue penumbra; the long shadow direction, pool edge, trailer, warm lamps, beams, asphalt details and surrounding blue darkness retain their layout. The shadow stays visibly colored. The final peak-strength version avoids the clipped blue glow seen in the rejected candidate.

## Accepted L1/L2/L4/L5 views

**All 16 baseline views are reproduced by the corrected code.** The primary matrix has 14/16 completely identical RGBA pairs. The two low-tier L4 pairs differ only in one background NPC (119 / 58 pixels in 18×12 / 12×8 bounds). An unchanged-code repeat of those two corrected frames matches the complete baseline images on **0 differing pixels**. The initial varying frames are retained; no region is excluded. [Per-frame proof and hashes](evidence/accepted-views.json).

| View | High, zoom 1 / 1.5 | Low, zoom 1 / 1.5 | Visual review |
| --- | --- | --- | --- |
| L1 entry | exact / exact | exact / exact | Warm street, purple directional shadows, green foliage, props and figures retain the accepted look. |
| L2 streets W1 | exact / exact | exact / exact | Cool midday pavement, storefront colors, crossings and lit facades remain identical. |
| L4 plaza safe | exact / exact | exact via control / exact via control | Golden plaza, towers, stalls, sandbags and shadow composition are unchanged; the first low pair varies only in one idle NPC. |
| L5 pair-plaza | exact / exact | exact / exact | The existing red haze, ruined silhouettes, figures and health bars remain identical. |

Sheets: [high zoom 1](../../../test-results/epics/E25/rest/accepted-high-z1-sheet.png), [high zoom 1.5](../../../test-results/epics/E25/rest/accepted-high-z1.5-sheet.png), [low zoom 1](../../../test-results/epics/E25/rest/accepted-low-z1-sheet.png), [low zoom 1.5](../../../test-results/epics/E25/rest/accepted-low-z1.5-sheet.png). Full 1280×720 frames are linked in the receipt.

The QA wrapper builds the original shader from `63814503` and the repaired shader separately. It restores repaired bytes in `finally`. Both sides use seed 1, the same paused tick/camera, fixed node time and geometry-based depth ties. The camera position is scaled about its fixed photo target, and actual zoom/radius are asserted. A frozen tick cannot finish prewarm pose crossfades; async civilian batch order also affects allocation of the existing IK budget. The capture therefore settles assets, sorts that traversal by model/tier and equally resets transient pose/contact/LOD history on both sides. Normal actors, current clips, materials, IK budgets, shadows and health bars remain enabled. These are QA-only controls; production animation is unchanged. Actual `fieldShadow` is **0 in every native view**, so the new correction is inactive there.

Earlier four-frame and readiness-only capture variations, plus a failed dev-server capture, remain archived. Production QA artifacts avoid HMR during the final A/B. The scoped visual review found no new scene/color/geometry glitch; this does not sign off the absent AC16 target comparisons.

## Validation and reproduction

**Final `npm run verify -- E25`: passed**, remote, with `VITEST_MAX_WORKERS=2`: typecheck **47.126 s**, lint **32.005 s**, unit suite **106 passed / one intentional legacy skip in 27 files**, **111.526 s** including its wrapper (240 s limit). QA production build passed in **19.01 s**. [Gate receipt](evidence/gate-final.json), [terminal log](evidence/gate-final.md). No test case/file or budget was added or raised.

The public build passed its no-QA-hook assertion (**21 HTML/JS files**) and public menu/L1 smoke (**1/1, 22.5 s**, three debug-query states). It emits the large-chunk advisory. Native WebGL2 and WebGPU program-limit and pedestrian smoke checks passed; the guarded spike and all scoped captures have zero browser errors.

**The full smoke command remains red.** It exceeded its 240 s wall budget at 245.3 s after four passing checks. Running the unfinished checks separately passed unflagged WebGPU boot but failed the extended handover test at **L8 APC boarding: expected true, received false**. The unchanged `63814503` QA artifact fails the **same assertion**, confirming it predates this shadow repair. No smoke limit/assertion was changed and no green full-smoke claim is made. [Both run receipts, baseline artifact and failure details](evidence/smoke.json). This is an additional reason E25 cannot be marked done.

- Spike: `BROWSER_POOL_BACKEND=gpu E25_SPIKE_PORT=4336 node --import tsx tools/qa/e25-lighting-spike.ts`.
- Pool/shadow: `SCENE_PORT=4337 E25_BACKEND=webgl2 E25_PHASE=after node --import tsx tools/qa/e25-rest-audit.ts`; repeat with `E25_BACKEND=webgpu` and with `--low` for both tiers.
- Native source A/B: stop other source consumers first, then `SCENE_PORT=4337 node --import tsx tools/qa/e25-rest-ab.ts`. It builds both QA artifacts, selects only the four native spots through the existing accepted-view tool, and uses 20 readiness rounds plus equal presentation-history resets. `--before-only` and `--after-only` split artifact phases; keep source synchronization outside the baseline mutation.
- Gate: `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/epics/E25/checks.json --env VITEST_MAX_WORKERS=2 -- sh tools/qa/e25-remote-gate.sh`.

The original local-server attempt failed under the earlier restricted sandbox; full-access retries produced the evidence above. JSON summaries and artifact hashes are committed; images and full traces stay local per repository policy. [Archive index](evidence/artifacts.json), [retention receipt](evidence/retention.json). No specification/status file, reference asset, dependency or deployment is changed.
