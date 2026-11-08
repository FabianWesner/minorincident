# E25 final repairs

2026-11-08 · base `d6ff72c1` · branch `lane/e25-final`.

## Changes

- [Night body highlights](fix-night-body-highlights.md): use the night-threat preset contract to bound infected body luminance; emissive eyes keep their authored colour. [Nurse eye repair](fix-nurse-eye-size.md): enlarge the two previously subpixel eye quads; all non-eye mesh accessors are unchanged.
- [Beam edges](fix-beam-edges.md): stable promoted-spot filtering, conservative light-field visibility interpolation, opaque-depth cone fading and analytic fracture antialiasing. Raw beauty-image gradients now pass the original 25% limit on both tiers, including the extra 28-ray audit (native WebGPU max 21.20%).
- [Native WebGPU depth copy](fix-beam-depth-format.md): match the stencil-bearing gameplay depth format and dispose the owned copy. Zero errors in the repaired native probe.
- [Wet reflections](fix-wet-reflections.md): real high-tier SSR, same wet mask, depth-derived normals, half resolution. Low tier retains practical streaks. Car-ID proof uses the actual SSR output; an exact geometric mirror supplies only the expected target.

No specification, threshold, status file, PO reference or dependency was changed. No push or deploy.

## Functional evidence

AC09: original four bands max **19.03%** on each tier. Expanded 28-ray raw-image maxima **19.36% high / 19.72% low**. Pool/outside and fence/ambient regression checks pass; [summary](evidence/beam-aa-followup.json). The additional fracture counterexample was repaired at its shader sampling cause, not excluded from measurement.

AC10: GPU floor-ID establishes actual drawn floor pixels with wet mask **1** and neighboring dry mask **0**. Turning off reflections produces a positive wet-pixel delta. Wet/dry ratios **5.38× / 3.13× high**, **3.78× / 3.27× low**. Actual car SSR IoU **33.98% WebGL2 / 34.49% native WebGPU** (≥30%); coverage **37.48% / 38.02%**. Zero browser errors. [Numbers](evidence/ssr-repair.json).

AC13: the repaired body maximum is about **0.101**, below the faintest measured visible eye **0.135**, (zebra); nurse eyes reach **0.173**. Coverage includes the 13 retained drawable infected definitions, six additional runner models and the natural NPC-dressed runner. Eight retired definition records without approved drawable rigs cannot be staged as production specimens; they are not silently counted as tested. Prior `night-street` player/ring contrasts **9.665:1 high / 10.266:1 low** pass 3:1.

### Visual review and accepted views

Lossless before/after sheets were opened: infected bodies retain their hue and eyes remain visible; the beam pools retain their warm colour, purple-blue shadow and fence occlusion, while stipple/hard wedges disappear. The actual SSR car-ID silhouette was opened alongside the geometric expected mask and SSR-on/off beauty pair. The expected full silhouette is larger than the partial screen-space hit mask; the measured overlap is reported without proxy substitution.

The fresh final high and low infected matrices each pass **20/20**, with zero errors, against the same immutable artifact. The full 20-model native contact sheet was opened after refreshing the high-tier matrix.

All **16 final L1/L2/L4/L5 pairs** were captured and their four tier/zoom comparison sheets opened. The warm L1 street, cool L2 midday view, golden L4 plaza and red L5 haze preserve their composition, palette, actors, shadows and health bars. These are not byte-identical claims: L1/L2 asphalt fracture coverage is now antialiased; the opened maximum-difference crop identifies the thin original crack. L4 beam-depth fading shifts channels mostly by ≤3/255, with four pixels at the upper-left pavement edge in low zoom 1.5 exceeding that range (max 14/255; the crop was opened). Full-image mean absolute channel difference is **≤0.020/255** in every pair; the largest single-channel difference is **26/255**, on a thin fracture. No pixels, actors or health bars were excluded. [Every pair, differences and hashes](evidence/accepted-views.json).

Both sides use the existing seed/tick/camera controls, deterministic draw ties and equal pose-history resets, with zooms asserted. Final source came from an immutable optimized QA artifact, avoiding dev optimizer/HMR changes during capture. The night-threat and promoted-field corrections are zero in these accepted presets; dry SSR skips offscreen passes after warmup. Local PNGs and full traces stay in `test-results/`, excluded from Git by repository policy. Committed summaries retain numbers and hashes.

## Validation and reproduction

`npm run verify -- E25` **passed** remotely with `VITEST_MAX_WORKERS=2`: typecheck **49.217 s**, lint **32.753 s**, unit wrapper **106.533 s** (**106 passed**, one intentional legacy skip, 27 files). QA build **18.77 s**. Test inventory remains **150 cases / 43 files**; no case, file or time limit was added. [Gate receipt](evidence/gate.json), [terminal log](evidence/gate.md). The gate runs shared checks only; it does not automatically evaluate these visual ACs.

Fresh final `npm run typecheck` and `npm run lint` also passed after the QA producer repair. **Full smoke remains red**: **5 passed / 1 failed**, 179.7 s within its unchanged 240 s wall cap. The failure is `L8 APC boarding exercised after warm-up` at `smoke.spec.ts:207` (expected true, received false). This is the same pre-existing assertion and unchanged-artifact reproduction recorded in [the prior repair lane](../e25-rest/README.md). It is not waived. Both backend GPU-limit and pedestrian checks plus unflagged WebGPU boot passed. [Fresh full-smoke log](evidence/smoke.md). The public artifact was checked separately because the full script stops on this QA failure: public build **13.22 s**, no-QA-hook assertion **21 HTML/JS files**, public menu/L1 smoke **1 passed, 15.3 s**, whole bounded command **32.7 s**. The build retains its existing large-chunk advisory. [Public receipt](evidence/public.md).

Capture commands use private ports, optimized QA output and headless ANGLE/Metal. The earlier sandbox socket failure is resolved: the normal browser pool now works; no legacy fallback was needed for these final captures.

```sh
NODE_ENV=production VITE_QA_HOOKS=1 node node_modules/vite/bin/vite.js build --config tools/qa/e25-vite.config.ts --configLoader runner
# Preserve that build in an immutable directory before running consumers.
SCENE_SERVER=preview SCENE_DIST=/tmp/e25-final-verified-dist SCENE_PORT=4347 sh tools/e2e-lock.sh node --import tsx tools/qa/e25-beams.ts
SCENE_SERVER=preview SCENE_DIST=/tmp/e25-final-verified-dist SCENE_PORT=4347 sh tools/e2e-lock.sh node --import tsx tools/qa/e25-reflections.ts
SCENE_SERVER=preview SCENE_DIST=/tmp/e25-final-verified-dist SCENE_PORT=4347 sh tools/e2e-lock.sh node --import tsx tools/qa/e25-night-readability.ts
# Repeat with --low; E25_BACKEND=webgpu requests a strict native manual probe.
```

[Artifact index](evidence/artifacts.json) records immutable QA chunk hashes, all final local captures and raw measurement receipts. Eight retired infected definition records are excluded from the drawable count explicitly, not reported as passing specimens.

## Performance

**The required AC14 scenarios pass the native E18 tier budgets.** Both attempts ran only through `tools/perf/quiet-run.sh` within the original **09:35:33–09:55:33 UTC** overall 20-minute deadline. The corrected batch finished at about 09:49:43 UTC. Quiet admission explicitly checked one-minute load <3 and no foreign browser/build/test workload, while the pool reserved exclusive capacity.

Headless native Chrome, ANGLE/Metal, 1600×900 DPR1, uncapped cadence; 120 warmup frames and **300 sampled advancing frames** per case. All cases assert simulation advancement and record **301 drawn frames**, without manual render pumping during the live sample. JS heap follows three GC collections. Actual raw receipts and admission conditions are in [performance proof](evidence/performance.json), [both terminal logs](evidence/performance.md).

| Scene / tier | Frame p95 ms | Sim p95 ms | Max draws | Max triangles | JS heap MB | All E18 budgets |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| light-lab high | 5.0 | 0.4 | 34 | 51,659 | 112.60 | Pass |
| night-street high | 6.2 | 0.9 | 141 | 307,012 | 144.97 | Pass |
| light-lab low | 4.8 | 0.3 | 27 | 32,161 | 101.56 | Pass |
| night-street low | 5.5 | 0.9 | 124 | 190,318 | 132.20 | Pass |
| Wet SSR stress, high | 10.7 | 0.5 | 47 | 269,348 | 112.43 | Pass in advancing native run |

Native GPU timestamps succeeded, with **zero browser errors**. Required-scenario complete GPU elapsed p95: **6.62 / 10.81 ms high**, **3.54 / 5.69 ms low**. Light-field GPU medians are **0.204 / 0.295 ms high**, **0.233 / 0.304 ms low**. The separate `perf().lighting.lightFieldMs` counter is CPU submission time and is labelled accordingly in the receipt. Lighting reports pools/candidates, shadow maps, hero lights and hero shadow activity; light-lab reports one promoted hero, night-street zero.

WebGL cannot nest elapsed queries. The light-field query and inclusive Render Pipeline query cover all submitted work, including scene, shadow, SSR, bloom and composition. Inner durations are **null**, never zero or independently timed claims. All pass names, sizes and inclusive timings remain in the raw artifact. This supplies complete aggregate work coverage without inventing individual shadow/SSR durations.

### SSR cost and limits

The same paused tick was measured **on/off/on/off**, 5 warmups discarded and 30 GPU samples per group. Complete GPU medians were **11.26 / 8.67 / 16.38 / 10.54 ms**, giving paired incremental costs **2.59 / 5.84 ms** for the seven active offscreen passes. Dry high-tier scenes skip them after shader warmup; low builds no SSR graph. The advancing native wet-scene p95 is **10.7 ms**, within 16.7 ms; this is the primary frame-budget result.

The later serialized SSR-on GPU group reached **17.21 ms p95**, above 16.7 ms. This is a measured headroom limitation in the isolated GPU diagnostic, whose elapsed spans include the inclusive pipeline and command-supply gaps; it is not the advancing native frame-p95 measurement. It is retained prominently, not discarded or presented as proof of uniform SSR headroom. No deployment or E25 completion is authorized by these measurements.

**Numbers-backed trade-off proposal for review:** if that serialized GPU stress ceiling is required for SSR sign-off, amend AC10 to permit the already proven practical-streak fallback on high when SSR lacks the 16.7 ms headroom. Retain >2× wet/dry contrast on both tiers and ≥30% car overlap whenever SSR is active. The visual cost is loss of the car silhouette in fallback; the measured saving is seven passes and 2.59–5.84 ms per paired GPU comparison. This is a proposed criterion change, **not an edited specification or an inferred approval**. The current branch contains the implemented SSR path and the actual measurements; E25 remains open for that headroom decision.

The first admitted attempt was rejected: the QA producer cleared an installed draw-profiler object, stopping renders while simulation still advanced. Its frame-advancement assertion caught **zero rendered frames**, so **no timing row was accepted**. The producer was repaired to reload without the visual profiler before Renderer construction, and the full corrected batch passed. The rejected artifact and both admission logs are retained.

```sh
E2E_ADMISSION_TIMEOUT_SECONDS=1200 MI_PERF_ADMISSION_TIMEOUT_SECONDS=1200 \
  python3 tools/browser-job.py --seconds 1200 -- sh tools/perf/quiet-run.sh sh /tmp/e25-final-perf-batch.sh
# Batch exports SCENE_SERVER=preview, SCENE_DIST=/tmp/e25-final-verified-dist,
# SCENE_PORT=4347, then runs e25-native-perf.ts high and --low sequentially.
# The retry shortened both watchdogs to the remaining original deadline.
```

## Remaining acceptance work

AC16 cannot be signed off from the available material. `assets/_keyframes/lighting/` contains its README only. The six still-required named image targets are absent; the documented earlier image manifest is absent too. `mall-floor` is not a registered loadable composition. L6 flashlight-on/main-power-off staging does not establish the complete pickup/failure progression review. No replacement targets were generated or inferred. [Fresh file inventory](evidence/checklist-blockers.json). [Earlier audit](../e25-verify/README.md).

**E25 cannot be marked done**: AC16 remains incomplete and full smoke remains red at the prior L8 APC boarding failure. The isolated SSR GPU headroom limitation is also retained for review. The three reported rendering defects have concrete repairs; functional proof does not replace performance or PO checklist sign-off.

## Per-AC table

| AC | Result | Evidence / remaining work |
| --- | --- | --- |
| AC01 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC02 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC03 | Met; regression passed | Pool/outside 35.29× high / 35.33× low; fence/ambient 0.617× / 0.999× |
| AC04 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC05 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC06 | Met; regression passed | WebGL2 both tiers/zooms 42.50–44.05% darker, hue 265.27–266.10°; native WebGPU high 42.41–44.00%, 265.27–266.08°, error-free |
| AC07 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC08 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC09 | Fixed; measured green | Original and expanded raw beauty-image bands <25% on both tiers |
| AC10 | Implemented; functional/native proof green, headroom review open | Wet/dry >2× both tiers; real SSR IoU >30% both backends; native wet-frame p95 10.7 ms; later serialized GPU p95 17.21 ms and numbers-backed fallback proposal above |
| AC11 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC12 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC13 | Fixed; measured green | 20/20 retained drawable cases pass on each tier; player contrast >3:1 |
| AC14 | Measured green for required scenarios | Both scenes/tiers pass native frame, sim, draws, triangles and heap; full aggregate GPU work timed; SSR stress limitation recorded above |
| AC15 | Met, prior proof | [E25 verification](../e25-verify/README.md) |
| AC16 | Incomplete / blocked on reference material | Missing named PO images, unregistered mall-floor and full L6 progression review |
