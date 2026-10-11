# A-D1 Alpha asset and Fairhaven fixture review

This is the asset/district row of E07, with partial AC01/AC12/AC19 coverage. Alpha sim balance, health bars, special moves, encounter counts and behavioral line destruction remain with their named lanes. No specification, protected reference, technology-reference file or campaign layout was edited.

## Delivered geometry

The worker build is the sole human source. Its real sculpted surfaces and rigid hierarchy are reshaped, not replaced with panels or boxes. The broadened clothed chest, shoulders, limbs and shoes retain a human silhouette. A locally reduced head balances the heavy torso; the measured LOD0 height is 2.5105 m versus the worker's 1.8 m (1.395×). Every ordinary shared run/swing/knockdown/get-up clip bakes finite, moving joints at every LOD. No triangles cross animated owners; far simplification retains emissive eye vertices. Hidden stump caps are real geometry and count toward the budgets.

| Tier | Packed triangles / limit | Packed KiB / 800 KiB limit | Palette materials |
| --- | --- | --- | --- |
| LOD0 | 7,777 / 8,000 | 74.72 | 4 |
| LOD1 | 2,781 / 3,000 | 45.71 | 4 |
| LOD2 | 728 / 1,000 | 30.36 | 4 |

The runtime merges these into its existing instanced crowd, using the original crowd animation bake and `crowdLodGeometry.ts`; there are no per-Alpha scene objects or textures. Fairhaven L4/L5 warm the model before post-initialization emergence, including the future `infected.alpha` definition. [Full GLB validation](asset-validation.json) has no errors.

## Reviewed before/after set

All images use the game's 25° lens and 54°/45° angle. Each left figure is the candidate; the right figure is the regular worker. Before uses two regular workers, after substitutes only the candidate's model. Scene Lab uses the shipped firefighter human brain to preserve explicit models across ticks; its L1 runner brain automatically acquires a civilian appearance. The worker is selected with the existing `infected.runner` crowd key. No screenshot is presented as proof of Alpha-specific gameplay.

| Probe | Before | After | Observation |
| --- | --- | --- | --- |
| LOD0, tick 30 | [before](before/before-alpha-asset-lod0/shot-0030.png) | [after](after/qa-alpha-asset-lod0/shot-0030.png) | Entire hair/head and planted shoes visible; heavier torso/limbs, open human face and glowing eyes remain readable. |
| LOD1, tick 30 | [before](before/before-alpha-asset-lod1/shot-0030.png) | [after](after/qa-alpha-asset-lod1/shot-0030.png) | Same adult human outline and larger body; no detached/floating limb islands or clipping. |
| LOD2, tick 30 | [before](before/before-alpha-asset-lod2/shot-0030.png) | [after](after/qa-alpha-asset-lod2/shot-0030.png) | Far silhouette still has head, shoulders, arms and two planted feet; red eye points survive. |
| Shared heavy reaction, LOD0 tick 120 | [before](before/before-alpha-asset-lod0/shot-0120.png) | [after](after/qa-alpha-asset-lod0/shot-0120.png) | Both rigs use the existing knockdown/recovery; no missing meshes or rig explosion. The right worker travels partly below the frame in both before and after; Alpha remains visible. |
| D-FAIR south line, tick 0 | [before](before/before-alpha-asset-fair-line/shot-0000.png) | [after](after/qa-alpha-asset-fair-line/shot-0000.png) | The right worker starts partly below the frame in both versions; Alpha is fully visible. Real L4 dressing and named anchors; a real E26 300 HP slot overlays the existing south-run sandbag at (-27.36, 17.8). |
| D-FAIR approach, tick 120 | [before](before/before-alpha-asset-fair-line/shot-0120.png) | [after](after/qa-alpha-asset-fair-line/shot-0120.png) | Both face and move toward the courier; no body/sandbag intersection, passing through props, invisible active actor or persistent vertical jitter. |

Retained metrics include full-run aggregates/gates and actor traces at capture boundaries and the worst-slide frame. All six Scene Lab scenes pass their unchanged gates, including zero console errors and zero invisible-but-active frames. Side-by-side LOD actors draw the intended LOD for all 180 frames. Flat-ground probes record zero sink; Alpha vertical jitter runs are at most one frame. The line approach records a shared **5 cm paving/grounding mismatch** in both before and after: Separation uses the district sim ground while the drawn plaza paving is 0.05 m higher. Initial `floorY` cannot override that movement grounding. Both rigs also retain the existing chase foot slide (p95 ~15 cm in the line scene); these are shared presentation limits, not hidden or relaxed gates. The forward-facing approach starts at yaw +90° toward the courier, avoiding a fixture-only 180° turn. The line's jitter run is one frame for both figures. The clipping scan also retains one existing static sandbag/HMG-nest overlap (`l4-sandbag-36` / `l4-nest-38`) in both versions; actor intersections are zero. No line-breaking damage, gap deletion or soldier concentration is scripted by this asset fixture.

## Validation

[typecheck/lint/build, units and verification summary](checks.json): the new asset tests pass; focused asset/optimization tests 16/16; browser tests 5/5. Full units: 808 pass, two failures. Unchanged HEAD `2a5e22ef` reproduces both `T-E09-01-wreck` and `T-E17-04`: the shipped wrecked fire-engine GLB lacks doorL/doorR. The sole temporary baseline worktree was removed. E07 verify: 162 selected sim/unit tests pass; 38 browser tests pass, the known `T-E13-05` save smoke fails. The ordinary adult 1.75–1.85 m assertions remain exact; the newly added Alpha has its separate PO 1.35–1.5× worker assertions, plus derivation/rig/material/LOD checks.

E18 fixed mixed-crowd counters (six Alpha models in 200 high / 100 low, human brains unchanged): **52 draws / 649,187 triangles high** versus 600 / 1.5M caps; **52 / 296,043 low** versus 300 / 500k. Crowd meshes cost four draws against the E07 ≤30 cap, with zero non-instanced crowd meshes. These paused fixed counters do not establish frame-time or physical-phone performance. The separate resumed [native-GPU probe](performance.json) uses headless Chrome / Apple M4 Metal, disabled vsync, 120 warm-up frames, and ≥720 frames / 12 seconds at 1280×720. It retained 200/100 actors and six Alpha models for 719/720 sim ticks: frame p95 **11.7 / 8.2 ms** against 16.7 / 33.4 ms budgets; published browser sim p95 **2.0 / 1.1 ms** against 4 / 6 ms; 52 draws and **661,319 / 296,091 triangles** at the moving endpoint. Both tiers have four crowd draws, zero non-instanced meshes and zero console errors. CDP used heap is **196.6 / 97.3 MB**; the page's coarsely published heap counter reads 627.6 / 392.7 MB and is also retained. This horde probe does not substitute for E18's after-L6 heap or real-phone checks. Reproduce with `SCENE_PORT=3382 E2E_SLOTS=1 sh tools/e2e-lock.sh npx tsx docs/reports/alpha-asset/performance-probe.ts`.

A separate Node E18 timing run under shared Mac load initially missed the high sim target (**5.326 ms / 4 ms**, low **1.502 ms / 6 ms**); [the first attempt is retained](node-performance-contended.json). E07 verification's 200-actor sim probe passed at **2.603 ms / 4 ms**. This lane changes rendering assets and loading only, with no sim timing changes.

The unchanged Node E18 tests passed **3/3** on the subsequent locked run: [600 sampled sim ticks after 120 warm-up ticks](node-performance.json), full living caps retained, p95 **3.329 / 1.077 ms** high/low against 4 / 6 ms. Both attempts are retained to show the shared-machine timing variability.
