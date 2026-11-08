# E25 verification — 2026-11-08

**E25 cannot be set done.** Fresh measurements find remaining contract and rendering gaps, and several acceptance checks lack the required evidence. No specification, target image or status flag was changed. Starting revision: `c58e0ced`, branch `lane/e25-verify`. **7 met / 5 red / 4 unmeasured in full** across the 16 criteria.

## Per-criterion result

“Met” means the stated check passed in the measured fixture/backend. It does not imply manual WebGPU or PO visual approval. Image luminance is linear RGB; captures are 1280 × 720, pixel ratio 1, through the shared headless browser pool with ANGLE/Metal. At most two browser jobs were used concurrently.

| Criterion | Result | Fresh measurement / remaining requirement |
| --- | --- | --- |
| AC01 — spike | **Unmeasured** | [Partial spike](evidence/spike.md): shipping/ACES/AgX compared at 34 draws, 51,659 triangles; mean luminance 0.06552 / 0.06394 / 0.06151. The required ClusteredLighting versus DynamicLighting comparison and reviewed decision are absent. Preserve the shipping curve pending review. |
| AC02 — anchor contract | **Red** | [Complete inventory](evidence/inventory-final.json): 1,032 model exports, 1,550 named anchors, all with metadata; **184 missing emitter references and 128 uncovered emissive meshes** remain. Another 401 non-model GLBs contain no light anchors. Matching authored sources are absent for 32 models, so their reference validation is unresolved. The narrower base-table check passes: 370 anchors / 95 assets / zero errors. |
| AC03 — pool / fence | **Met, WebGL2 high and low** | Inside/outside pool means: high 0.59874 / 0.011754 = **50.94×**; low 0.59949 / 0.011737 = **51.08×** (target ≥4×). Behind-fence / ambient = **0.521× high, 1.000× low** (target ≤1.3×). Fixed world masks: 376 / 125 / 289 points. |
| AC04 — backend parity | **Unmeasured** | WebGL2 images and masks captured on both tiers. WebGPU requires manual validation under repository policy; no ±10% paired-backend claim is made. |
| AC05 — hero budgets / transitions | **Met, WebGL2 high and low** | Actual movement for 60 s, 40 registered lamps, **119.95 m** travelled. Maximum **1 light / 1 shadow map**, under 8/3 and 3/1 budgets; 40 selection changes, maximum **1 change per rolling second**. Fade completes at sample 18–19 (0.300–0.317 s at 60 Hz; floating-point completion sampling). Maximum pool-centre frame luminance delta **8.235% high / 8.263% low**, below 15%. |
| AC06 — shadow | **Red** | Behind / beside means 0.43512 / 0.83896: **48.14% darker**, passing ≥35%. In a shadow mask restricted to pixels darkened ≥35% against a same-frame no-caster control, mean darkness **55.76%**, RGB (188.17,154.72,179.38), hue **315.75°**, outside **230–290°**. No retinting of accepted scenes was attempted. |
| AC07 — generator | **Met** | Real generator interaction emits `power.on` at tick 1. Recorded emissive transitions at ages **18, 36, 60 ticks** (0.3 / 0.6 / 1.0 s), then stable on. `power.off` makes all four emissives zero immediately; the next rendered frame has **0 lit statics, 0 beams, 0 reflection effects**. The courier aura remains separate. |
| AC08 — breakage / sight | **Met** | **One pistol hit** produces `light.broken`, an electric sparks VFX event and light-off state. Real `Perception.inCone` threshold falls from **16.0 m to 9.6 m**, a **40.00%** reduction. |
| AC09 — beam intersection | **Red, raw image band** | Four cone-to-floor lines sampled over 96–101 pixels. Maximum full-image adjacent luminance gradient **33.46%**, above 25%. A same-frame beams-disabled control isolates a maximum beam contribution gradient of **2.43%**: background texture/shadow edges contribute to the raw failure. This control is diagnostic; it does not waive the written image threshold. |
| AC10 — reflections | **Red** | **0 SSR passes** in the renderer; high-tier SSR is not implemented. Wet-streak / neighbouring-pixel diagnostic ratios are **3.28× high / 3.36× low**, but the neighbours were not independently proven dry, so these do not establish the complete wet-mask clause. A mirrored-car geometry proxy is not an SSR ID pass; its overlap is excluded from acceptance. |
| AC11 — material classes | **Met, WebGL2 high** | At 45° and 60°, gloss-versus-matte controls differ on **97,119 / 90,293 pixels** above 0.01 linear luminance; highlight centroids (617.87,349.39) → (643.56,374.24), **35.74 px** apart. Controls touch only the car's drawn vertex indices in the shared arena. Matte removes the env contribution; chrome control visibly reflects the environment. Shader env mixing weights are **0.18 gloss / 0.93 metal**, consistent with the captures. |
| AC12 — window depth / power | **Met, WebGL2 high and low** | Registered interior scanline, frame/mullion excluded, 15° camera change: back-wall edge shift **113.87 px high / 22.21 px low**, both ≥4 px. Powered/unpowered maximum interior luminance ratios **9.59× / 9.92×**. Powered and unpowered images archived. |
| AC13 — night readability | **Red** | Real `night-street`, open legal spot (15,−2), nearest practical **10.05 m**: courier/ring contrast **9.665:1 high / 10.266:1 low**, passing 3:1. In the no-practicals infected fixture, three visible red-eye specimens have body maxima **0.311–0.421**, above eye maxima **0.199–0.213**; eyes are not the brightest pixels. A fourth specimen has concealed eyes. This is a failing specimen check, not full archetype coverage. |
| AC14 — performance | **Unmeasured in full** | Fresh draw/triangle/JS-heap counters pass both tier limits; see table below. Lighting counters are exposed. Native frame timing was attempted but **quiet admission timed out after 120 s**, with host load 8.1–13.5. No frame p95 or GPU-pass timing is inferred from paused renders or CPU submission times. WebGPU timing remains manual. |
| AC15 — previews | **Met** | Real Blender 5.2.2 LTS batch: **95 / 95 light-bearing assets, 190 / 190 nonblank 640×480 day/night images**, zero missing assets, remote exit 0. [Preview manifest](evidence/previews.json) records every render hash and image statistics. Fresh turntable generated five views plus night-on/off comparison, without browser errors; coverage **15.84–32.22%**. |
| AC16 — checklist G | **Unmeasured / cannot sign off** | Native L1–L6 spots captured. `assets/_keyframes/lighting/` contains only its README: the six still-required named target images are absent. `mall-floor` fails to load with **Unknown composition: mall-floor**. L6 was staged with flashlight on / metro-main off to inspect the current PO darkness direction; this is not proof of the complete pickup/failure progression. Targets were not regenerated. |

## Performance counters

Explicit node frames were submitted before reading renderer counters; post-FX-only cached draws are excluded as invalid samples. Heap is CDP `Runtime.getHeapUsage().usedSize` after three garbage collections, rather than `performance.memory` including backing-store accounting. These are the requested fixtures, not a five-load leak test or L6 heap proof.

| Fixture / tier | Draws | Triangles | JS heap MB | E18 draw / triangle / heap ceilings |
| --- | ---: | ---: | ---: | --- |
| light-lab high | 34 | 51,659 | 131.5 | 600 / 1,500,000 / 400 MB |
| light-lab low | 27 | 32,161 | 123.5 | 300 / 500,000 / 250 MB |
| night-street high | 155 | 757,965 | 168.1 | 600 / 1,500,000 / 400 MB |
| night-street low | 142 | 335,779 | 164.4 | 300 / 500,000 / 250 MB |

`perf().lighting` reports light-field CPU submission time, pool/candidate count, shadow map count and hero count. Typical snapshots report 0.2–0.8 ms light-field work; these are not isolated GPU timings. The night-street fixture is the registered `game.loadLevel('night-street', {seed:1}, 'perf-night-street')` scenario.

## Repairs and accepted looks

Each fix is its own commit:

1. `aff51cba` — [disabled sockets and validator coverage](fix-disabled-sockets.md): rename 339 dead reserved sockets in 75 shipped plus 75 authored exports; enforce metadata, parameter and emitter contracts in the existing validator/test family.
2. `16a93270` — [fire-engine emitters](fix-fire-engine.md): author nine anchors per tier, regenerate the base runtime table, resolve references against matching authored LODs.
3. `36a7f3a2` — [school-bus LOD references](fix-school-bus.md): bind the native head/brake emitters to their surviving material batches, preserving all anchor settings and geometry.

Every repaired GLB has an archived exact binary-payload identity proof. Native accepted-view comparisons are recorded per fix. Initial asynchronous captures showed NPC/health-bar pose differences; capture calibration holds the simulation clock paused throughout level loading, freezes node time, replaces object-ID-only depth ties deterministically and applies the same manual step request. The corrected school-bus L5 pair explicitly holds both worlds at tick 0. No character, pixel region or rendering feature is removed to claim identity. The corrected [school-bus L5 pair](evidence/school-bus-l5-clock-fixed-identity.json) differs on **0 / 921,600 pixels**; L1/L2/L4 also compare exactly.

The known SSR, shadow-hue and eye-brightness gaps require rendering/authoring work and new evidence. Changing those looks without the required accepted-scene proof would exceed the safe scope of this verification lane. Remaining stale LOD references need source-specific review; no decorative exemptions or lowered thresholds were added to silence them.

## Validation

**Final `npm run verify -- E25`: passed**, remotely, with `VITEST_MAX_WORKERS=2`: typecheck **51.811 s**, lint **32.037 s**, unit suite **106 passed / 1 intentional legacy skip across 27 files**, **109.5 s** under its 240 s budget. QA production build passed in **18.38 s**; remote wrapper exited **0**. [Machine receipt](evidence/gate-final.json), [terminal log](evidence/gate-final.md). Earlier four-worker runs timed out in navigation and L4 contact while the preview batch shared the runner; with two workers after previews, those tests passed in **13.96 s / 12.30 s** without raising any limit. The earlier failures remain archived. The built WebGL2 pedestrian smoke passed **1/1 in 49.6 s** via the browser pool, one worker, private port 4408. WebGPU smoke and parity were not automated under the repository's manual-WebGPU policy. A QA production build was generated remotely. No push or deployment was performed.

## Evidence and reproduction

[Archive index with original paths and SHA-256 hashes](evidence/archive-index.json). [Numeric summary](evidence/measurements.json) retains the measurements and renderer snapshots. Per the repository evidence policy, images and full frame/scanline traces remain local and are not committed; the manifest records their hashes. [Simulation trace](evidence/sim-after.json), [full inventory](evidence/inventory-final.json), [spike](evidence/spike.md), [timing admission](evidence/timing-admission.json).

Representative captures: [light lab](evidence/after-high-light-lab.png), [shadow / beams](evidence/details-high-shadow-beams.png), [infected eyes](evidence/details-high-night-eyes.png), [gloss 45°](evidence/details-high-material-45.png), [gloss 60°](evidence/details-high-material-60.png), [matte control](evidence/details-high-material-45-matte.png), [metal control](evidence/details-high-material-45-metal.png), [window 45°](evidence/extra-high-window-45.png), [window 60°](evidence/extra-high-window-60.png), [window off](evidence/extra-high-window-off.png), [turntable on/off](evidence/turntable-night-on-off.png).

Manual probes are in `tools/qa/e25-{sim,inventory,render,walk,extra,detail,spot}-audit.ts`. Run with `node --import tsx/esm`; use a private `SCENE_PORT`, and run high/low separately with `--low` where supported. `e25-extra-audit.ts --counters` captures both performance fixtures. `e25-walk-audit.ts` performs the real 3,600-tick walk and bilinear pool-centre readback. `e25-assets-ab.ts` restores only the GLBs named by `E25_IDENTITY_FILE`, using `E25_BEFORE_REF`, and restores repaired bytes in `finally`; do not run A/B mutations during remote source sync. Use `E25_LEVELS` to limit native views.

Heavy validation uses `tools/remote/run.sh` with `tools/qa/e25-remote-gate.sh`. The disposable remote Git checkout originally lacked HEAD objects; the wrapper creates a genuine snapshot of the synced `src/` and `public/` inputs for the unchanged review-freshness tests. It refuses to run outside `MI_REMOTE=1`. Remote execution retains the runner's shared slot locks. The Mac dispatch FIFO had stalled on unrelated jobs; a task-specific remote-only dispatch queue was used with local CPU fallback disabled. No other job or shared queue ticket was removed.

The manual probes extend no test counts. The validator regression cases were folded into the existing asset-contract test, as required by the current test strategy.
