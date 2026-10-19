# perf-w5b — final report

Base: `8db67f235`. **Incomplete.** The named WebGL L7 horde p95 target is met; L4 low remains red, as do rare WebGL L7 hitch limits and WebGPU low p95. Inherited visual failures also remain open. No deployment or merge.

## Before / after

All limits, character populations, persistent corpses and L5 difficulty are unchanged. Historical queued-job figures and the fresh same-job base measurements are shown separately.

| Item / test ID | Before | Final source | Result / cause and fix |
| --- | --- | --- | --- |
| L7 low horde `T-E29-19-encounters` | Historical **52.4 ms** p95; fresh base WebGL **34.0 / 50.6 ms** p95/max | WebGL **32.1 / 53.1 ms**; WebGPU **34.3 / 36.9 ms** | WebGL p95 meets **33.3 ms**. Exact occlusion/cover rejection, reused shader graphs and fewer instance buffers reduce work. The full WebGL case still fails its **50 ms** maximum; WebGPU p95 remains red. |
| L7 low district `T-E29-19-district` | Fresh base WebGL **33.8 / 37.2 ms** | WebGL **29.7 / 37.3 ms**; WebGPU **34.7 / 37.0 ms** | WebGL passes with 100 infected and all 28 fires retained. Shared query/render fixes; WebGPU p95 remains red. |
| L4 low first turn `T-E22-20` | Historical **60.7 ms**; fresh base WebGL **73.9 ms** | WebGL **62.7 ms**; WebGPU **60.1 ms** | Both exceed **50 ms**. Repeated actor/cover/refuge scans, soldier sorts and cold reveal variants were reduced. The remaining post-alarm catch-up frame is unresolved. The intermediate focused **48.4 ms** probe is superseded by the full acceptance result. |
| L4 low tank / line break / sim `T-E22-20` | Fresh base WebGL **32.8 / 101.0 / 6.6 ms** | WebGL **32.2 / 59.8 / 6.1 ms**; WebGPU **30.1 / 49.9 / 5.8 ms** | WebGL line break exceeds **50 ms**, sim p95 exceeds **6 ms**. WebGPU passes these three values. |
| L7 low repeated rockets `T-E29-19-rocket` | Fresh base control not measured for this item | WebGL p95/max **15.9 / 60.6 ms** | p95 passes; maximum exceeds the unchanged **50 ms** gate. Remaining transient cause is unconfirmed. |

The final horde maximum occurs near the start of its measured window, with no new shader programs. Its hitch records 10.6 ms simulation. The rocket hitch records 5.5 ms simulation, 6.3 ms update and 5.7 ms render; those counters do not establish the cause of the remaining elapsed time. No claim that these hitches are fixed, or that they are caused by GC, is made.

## Final native measurements

Headless native Metal Chrome, one worker, fresh production build `index-Wk4oQil5.js`. Runtime source hashes are in [source-sha256.json](source-sha256.json). Numbers are milliseconds.

| L4 backend / quality | First turn | Tank | Line break | Sim p95 |
| --- | ---: | ---: | ---: | ---: |
| WebGL high | 18.6 | 11.9 | 24.7 | 2.5 |
| WebGL low | **62.7** | 32.2 | **59.8** | **6.1** |
| WebGPU high | 17.1 | 9.9 | 18.7 | 2.1 |
| WebGPU low | **60.1** | 30.1 | 49.9 | 5.8 |

| L7 workload / backend | High p95 / max / sim p95 | Low p95 / max / sim p95 |
| --- | --- | --- |
| District / WebGL | 11.8 / 30.4 / 1.9 | 29.7 / 37.3 / 4.2 |
| Horde / WebGL | 10.9 / 25.6 / 2.0 | 32.1 / **53.1** / 4.3 |
| Repeated rockets / WebGL | 7.6 / 22.8 / 1.3 | 15.9 / **60.6** / 2.3 |
| District / WebGPU | 11.7 / 16.9 / 1.8 | **34.7** / 37.0 / 3.9 |
| Horde / WebGPU | 11.0 / 26.7 / 1.8 | **34.3** / 36.9 / 4.0 |

[WebGL evidence](source-final-native-webgl/), [WebGPU evidence](stream-native-webgpu/), [fresh base](baseline/). Earlier source snapshots remain historical evidence in the other folders and [work-log.md](work-log.md); they do not replace final-source results.

## Changes and exactness checks

| Cause | Smallest implemented change | Before / after evidence | Test ID |
| --- | --- | --- | --- |
| Dense static geometry repeated triangle scans | Build indirect `three-mesh-bvh` trees during loading; exact finite transformed rays and original material sides; small geometry retains `Mesh.raycast` | Same hit results, near/far, groups, nonuniform scales and compact draw indices; source geometry unchanged | `tests/unit/render/instanced-occlusion.test.ts` |
| Spawn admission allocates corners/axes and tests distant walls | Scalar frustum corners, conservative candidate wall bounds and slab rejection | Original algorithm oracle on 3 origins x 1,089 points; same visibility | `T-E22-20-silhouette` |
| Navigation scans all bucket candidates before finding a blocker | Test candidates on insertion; stop on the first exact blocker; keep masks, narrow-wall and rounded escape semantics | Real L4 60,800-query median **298.616 -> 107.057 ms**, identical results | `T-E22-20-nav` |
| Cover slab tests continue after an impossible interval | Reject immediately after X/Y slabs | Real L4 60,800-query median **57.023 -> 53.956 ms**, identical distances; 5,000-ray oracle | `T-E22-20-cover-slabs` |
| Reveal and LOD transitions rebuild material graphs | Cache each exact mode/feature graph and retain owned LOD material copies; warm reveal variants during loading | Twelve weather/feature graphs reused; actor state remains independent, all owned copies disposed | `T-E22-20-reveal-cache`, `T-E22-20-setpiece-materials` |
| Alarm repeatedly sorts soldiers and allocates full actor descriptors | Stable nearest loop over one roster, direct model counts and borrowed refuge targets, unchanged cap count | Real L4 alarm +120 ticks equals old methods for every entity/look/target/mission field/event; 1,600-query model **53.536 -> 48.994 ms**, refuge **50.614 -> 32.516 ms** | `T-E22-20-refuge`, `T-E22-20-spawn-room` |
| Allied scans compute unused threat and cover queries | Skip unused consumers; apply unchanged distance/post and target score before pure camera/LOS queries | Same chosen target, forced hearing and cover behavior; fewer visibility calls | `T-E22-20-ally-range`, ally defence/cover suite |
| Mounted HMG computes an unused handheld muzzle and sorts all nests | Obtain exact mounted barrel first; stable nearest loop with scratch vectors | Same nested-transform socket and tie/range behavior | `T-E22-20-mounted-muzzle` |
| Per-model instance fields use separate GPU buffers | Interleave civilian frame/tint/overlay and infected state/tint; same floats, slots, attribute locations and upload range | Civilian **3 -> 1** buffers, infected **2 -> 1**; all 350 civilian slots float-exact. No claimed frame improvement from packing alone | `T-E18-instance-stream` |

The remaining WebGPU L4 hitch is a post-alarm catch-up frame. In the instrumented diagnostic, tick 4557 records 21.4 ms total simulation, 8.8 ms view update and 9.1 ms render; the following frame advances three ticks with **52.6 ms total simulation**, 11.2 ms update and 9.7 ms render. Shader builds remain fixed at 396. Its 82.6 ms frame is diagnostic overhead evidence, not the ordinary-path 60.1 ms acceptance measurement.

Microbenchmarks are relative CPU evidence, not native frame-budget substitutes. `diagnostic/` retains reproducible benchmark sources as `.ts.txt`, original-method controls and profiles. Rejected vehicle paint caching and navigation stamp variants are absent from production. A final-source L4 path-call diagnostic found **17 path calls in the first 10 post-alarm ticks and zero repeated completed keys** (63 calls / zero repeated keys over 180 ticks); no proposed path-result cache was added (`diagnostic/path-calls.json`). Dependency `three-mesh-bvh@0.9.16` is pinned, MIT, and included in generated credits/notices.

## E18, lighting, weather and lifecycle regression

The final E18 browser suites have **28 passing checks and one existing physical-device manual skip**: seven native desktop/device/memory cases plus 21 counter/download/adaptive/context/mobile cases. This does not erase the L4 and L7 budget failures above. Physical iOS/Android recordings remain manual.

| Check / test ID | Final recorded result |
| --- | --- |
| Desktop `T-E18-09` | 200 infected, p95 **5.7 ms** against 16.7 ms. Pre-stream source was also 5.7 ms; the inherited 2026-10-07 receipt was 9.2 ms and is a different-session reference, not a causal baseline. |
| Four mobile proxies `T-E18-08-*` | Android 4x / iOS 2x CPU, WebGL/WebGPU, 100 infected each: p50 **59.88 fps**, all pass. |
| Five loads `T-E18-05-*` | High heap **81.295 -> 83.501 MB (+2.714%)**, low **69.569 -> 73.041 MB (+4.990%)**. Geometry **545->522 / 557->534**, textures **53->54 / 41->42**; all within 10%. |
| Download `T-E18-03` | All eight skin/quality/backend combinations pass. Maximum **14,915,898 / 15,000,000 bytes**, male/high/WebGL. |
| Adaptive/context `T-E18-04-browser`, `T-E18-06` | Quality drop **5,129 ms** (limit 6 s); context restore **2,109 ms** (limit 3 s), plus paused-simulation/input checks pass. |
| Light lab `T-E25-14c` | High p95 **7.2 ms**, heap **129.74 MB**; low p50/p95 **8.9/11.1 ms**, heap **85.75 MB**. Earlier committed-report collected heaps were 131.71/87.80 MB (different session). |
| Night street `T-E25-14/14b` | High morning/night p95 **8.2/7.9 ms**; low morning/night p50 **15.6/16.5 ms**, recorded night p95 **33.6 ms**. Low gate remains its existing p50/daylight-relative contract. Night heaps **160.11/102.40 MB**. |
| L5 ash `T-E23-19` / `T-E28-10` | High p95 **8.1 ms**; low p50/p95 **15.5/33.6 ms** (existing low gate is p50). Both retain five followers, 13 fires and 37 corpses; heaps **102.85/79.85 MB**. |
| Storm `T-E28-10-frame` | High/low frame p95 **5.2/5.5 ms**, maxima **7.5/14.7 ms**, heaps **103.98/68.82 MB**. |
| Four disposal cases `T-E23-19-lifecycle`, `T-E29-20-lifecycle` | L5/L7 high/low round trips pass heap/GPU resource limits and preserve gore Off, flash reduction on and camera shake off. |

The final lighting/weather/lifecycle batch passes **14/14** in 5.1 minutes. Evidence: [E18](source-final-e18/), [lighting/weather](source-final-light-weather/), [lifecycle](source-final-lifecycle/), [receipts](receipts/).

## Matrix and visual review

**192 final unique cases pass:** sixteen scenes x two qualities x three zooms x two backends. This includes the original eight scenes and eight additions for the changed areas. Required high/low x zoom 1.0/0.5 x WebGL2/WebGPU corners were all inspected: **128 conditions / 384 sampled labelled frames**. Zoom 1.5 has additional numeric coverage. All actual backend/tier checks match, with zero console errors.

The first WebGL pass was 96/96 (631 s); visual inspection found its inherited HMG fixture hid the mount behind scenery. A revised isolated production nest adds a target-HP-0 gate and passes six replacement WebGL rows. The full WebGPU pass uses that revised fixture and passes 96/96 (618 s). Thus 198 raw cases were executed, with six superseded; original receipts are retained. [coverage-final.json](coverage-final.json) identifies the final 192 cases and hashes the catalog sources.

[The visual review](review/README.md) describes every scene and links all sixteen condition comparisons. It records retained clothing/headwear/bodies, held props, navigation around the table, convoy/LOD/cutaway behavior, the visible HMG barrel/flash and body, bounded sedan reveal, cover hits, ash, rain and rocket effects. It also records crop limits, bright light-lab washout and high close rocket-smoke occlusion; it does not claim those existing readability issues were fixed. Final L4 war and 20-body-return captures were also inspected: [captures](source-final-captures/) and [native WebGL](source-final-native-webgl/).

## Tests and verifier receipts

All heavy CPU suites ran on Hetzner, at most four workers: **1,651 unit tests pass / 7 existing skips** and **1,532 simulation/level tests pass / 2 existing skips** — **3,183 pass / 9 skips** on the frozen production source. Simulation timing cases use isolated runner slots. Final typecheck, lint and fresh builds pass. Temporary diagnostic specs/helpers are removed from discovery and archived as text.

| Verifier | Remote selection | Browser | Native / status |
| --- | --- | --- | --- |
| E22 | 125 pass; snapshot predates last ally/stream changes | Final source **91 pass**, including all 17 convoy cadence configs | High passes, low fails. Final browser/native use the fresh final build; final complete CPU suites supersede the earlier remote snapshot. **Red.** |
| E25 | 50 pass | 48 pass, 2 existing skips, 1 inherited shadow failure | Verifier stops before native; final standalone lighting **4/4 pass**. Final-source shadow repeat fails identically. **Red.** |
| E28 | 25 pass | 70 pass | Original full verifier **6/6 native pass**; it precedes later AI/stream changes, with identical weather code. Final-source six weather/L5 native cases also pass. **Green receipt, snapshot qualified.** |
| E29 | Final source 104 pass | **40 pass / 4 inherited visual failures** | Verifier stops before native. Fresh standalone native **4 pass / 2 low hitch failures** provides all six final timings. **Red.** |

### Inherited visual failures, controlled against 8db

- `T-E25-06`: final-source shadow darkness **-0.07202395355885516**, hue **11.380967638577374**, exactly matching original source. Both captures were inspected; the expected dark purple ground shadow is absent at the probe. [Control](shadow-check/).
- `T-E29-14`: rocket courier contrast high/low **2.019929327882546 / 2.0897818373034385**, below 3.0. Original and final source produce **byte-identical captures and masks**, with identical pixel counts/ratios. The courier is among a lit follower crowd; no contrast repair is claimed. The canonical test stops at rocket, so its subsequent horde contrast remains unmeasured. [Control](l7-visual-check/).
- `T-E29-18`: all four `pair-*` anchors read by the test are absent from the raw public D-FAIR layout. That file is byte-identical to 8db. Both qualities fail before their image loop on original and final source, so those W5/W6 pair captures remain unmeasured. No criterion or fixture was loosened. [Fixture evidence](l7-visual-check/pair-fixture.json).

The original-source control is an immutable separate production build made earlier with tracked runtime overrides loaded from `git show 8db67f235`; the overrides are hash-verified in [baseline-control.json](diagnostic/baseline-control.json). No source checkout or forbidden reference files were modified. [Verifier JSON](verifiers/) and complete compressed [console receipts](receipts/) retain the failures as well as passes.

## Constraints and remaining work

Browser runs were headless on the Mac, one owned browser at a time, one worker/catalog job, unique ports and standard locks. Native runs used `quiet-run.sh`: at most 1,195 seconds per held reservation, release between batches, cooldown and substantial normal-QA/offline gaps. Recorded completed native batches stay below 20 minutes; the largest was 10.5 minutes. No browser admission exceeded 30 minutes. CPU suites stayed remote. No deploy, merge, population/corpse/limit reduction, L5 difficulty change, spec edit or forbidden-directory edit; unrelated `staticCollision.ts` churn is absent.

Remaining: close L4 low turn/line-break/simulation limits; eliminate the rare WebGL L7 hitches; close WebGPU low p95; repair the inherited visual failures and complete their blocked subchecks; obtain physical-device recordings. These remain open, not waived.

Large traces/receipts are losslessly compressed (`gzip -dc file.json.gz`). Source/case manifests and index files remain readable. Archived `.ts.txt` diagnostics can be restored to their original `tools/perf/` or `tests/perf/` locations and run through the same wrappers. Relevant generated results are copied here; tracked `test-results/` churn is excluded from the commit.
