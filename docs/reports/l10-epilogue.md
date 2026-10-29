# L10 epilogue and R1 QA (Q-235 / Q-236)

## Q-235: cause and regression origin

The supplied capture shows the collapsed infected crowd. E32 §5.8 explicitly kills infected with the cure; healthy survivors emerge separately, stay alive, and walk/idle. There is no infected-to-healthy conversion.

The same seeded Scene Lab release was run on **batch 28 `763b56c87`** and **pre-fix batch 29 `469bcaffa`**: 72 living infected near the console and the real survivor controller. Both builds produce **68 overlapping corpse footprints** after the approaching group collapses. Survivor routes were also observed through 110 seconds. This predates batch 29; the narrow roads, look dressing and Q-233 actor IDs did not introduce it.

Two older behaviors explain the picture:

- `591eb20c9` (2026-10-24, “Bound corpse settling to one metre and retain layered heaps”) limits render settling to 1 m, so the dense final horde becomes layered clumps.
- Cure mist introduced in `888e63f33`, expanded for the pullout in `39c200c8f` (2026-10-14), reuses full-height smoke spheres at 0.32 opacity. These overlap entire figures and produce a pale veil. The figures themselves are **opaque**: diagnostic materials all report `transparent=false`, `opacity=1`, `fade=1`. Removing the corpse cutout leaves the distant clumps unchanged; removing mist removes the veil. There is no stuck cure-fade material.

The final fix gives L10 epilogue corpse settling up to 4 m of supported floor, refreshing already-frozen bodies once at release. The identical cohort now has **6 overlapping footprints**, **0 interpenetrating pairs**, maximum lift **0.22 m** and maximum displacement **3.6 m**; the courier footprint remains clear. Combat settling elsewhere remains at 1 m. Mist is flattened to a low bank (vertical scale 0.14, opacity 0.20), so upright survivors remain above it. The six healthy survivor routes use wider, nav-resolved slots instead of the original compact 1.3 m grid. Their existing walk/pause/idle animation remains in use. The original corpse visibility cutout remains intact. Diagnostic captures: [mist disabled](l10-epilogue/captures/diagnostic-no-mist.jpg), [mist and corpse cut disabled](l10-epilogue/captures/diagnostic-no-mist-no-cut.jpg).

Reviewed captures: [batch 28](l10-epilogue/captures/batch28-release.jpg), [batch 29 before](l10-epilogue/captures/before-release.jpg), [after](l10-epilogue/captures/after-release.jpg), [survivors before](l10-epilogue/captures/before-survivors.jpg), [survivors after](l10-epilogue/captures/after-survivors.jpg). Raw cohort and material evidence is in [l10-epilogue/evidence](l10-epilogue/evidence).

## Q-236: R1 pole and flood

`6ba51eb28` pulled the field pole line from its old 17–21 m setback to 7.5–9.5 m. The foreground pole `prop.utility-pole:3242` at **(556.63, 8.91)** then projects its crossarm across the start-area camera. It now sits 18 m downstream at **(574.63, 8.91)**. The layout source, generated placement/collider JSON and GLB marker agree; the placement count, IDs and random dressing decisions are preserved. No runtime placement workaround remains.

The real seeded L10 high-z1 camera reproduces the supplied obstruction from the start verge at (551.5, 4.5): [before](l10-epilogue/captures/before-start-verge.jpg) / [after](l10-epilogue/captures/after-start-verge.jpg). Start and the first 10 m of the road were also reviewed.

Only R1's flood-marked evac towers are adjusted: the authored spot direction remains, with warm light, intensity **6 → 3.2**, and range **24 → 14 m**. The smaller pool falls off into the night instead of bleaching the evac verge. [Before](l10-epilogue/captures/before-flood.jpg) / [after](l10-epilogue/captures/after-flood.jpg).

## Verification

- `npm test`: **106/106**, with no new test cases; typecheck and lint passed.
- `npm run layouts:build -- D-CURE`: passed; only the selected pole changes placement. Static-overlap census remains **182 → 182** (existing authored overlaps).
- Finale constants and `tools/qa/l10-arrival-check.ts` are unchanged. Final source timing: **143.15 / 143.22 s**, cure released, zero deaths. Outcome hashes remain `d23478b9b16dd471` / `162c72fc08608d6f`.
- Full 2,200-frame high/low epilogue scenes: passed, including title transition, six/three survivors, fan/mist budgets and healthy safety. Reviewed [high](l10-epilogue/captures/epilogue-high.jpg) / [low](l10-epilogue/captures/epilogue-low.jpg) sheets.
- R1 AC16: high/low passed; sampled navigation median is at least **3.0:1**, player contrast at least **7.09:1** (required 2.5 / 3.0).
- `npm run test:smoke`: **6 QA tests + 1 public-build smoke passed**, 129.2 s inside the 240 s budget; public build exposes no QA globals.
- `npm run scene:gate -- --jobs 2`: **48/48 passed**, 0 known failures, 0 not run, all four batches exited 0. [Summary](l10-epilogue/evidence/scene-gate-summary.md) / [raw log](l10-epilogue/evidence/scene-gate.txt).
- Headless Metal WebGL2 captures and shared browser-pool jobs only; no 3300 server, publish, or deployment.

## misc-30 follow-up (2026-10-29)

- **Real low cast:** the cure fixture now sets the gameplay director tier before restoring the epilogue. The review harness asserts both gameplay and render tiers and the exact cast size. At 60 seconds, both tiers are `low` and all **3** survivors are visible, solid and spread on individual walking routes in the [reviewed capture](misc-30/captures/epilogue-low.jpg); [runtime evidence](misc-30/evidence/epilogue-low.json), no console errors. The cast camera now frames the live group together instead of cropping it at a fixed target.
- **Q-234:** one continuous collision strip joins the existing R3 barricade footprints without changing the visible props. It is appended after dressing to preserve every other ID and clearance decision. Real D+S keyboard probes stopped at x **1515.005–1515.010** at z≈9 and every one of the 30 sampled gaps. Both intended detours at z **−55 / 100** crossed to x **1526.043**. [Capture](misc-30/captures/r3-blocked-z9.jpg), [33 input probes](misc-30/evidence/r3-input.json). The Blender rebuild passed and the generated layout differs from main only by this collider.
- **Finale timing:** `tools/qa/l10-arrival-check.ts` was run on detached main `1eb327524` and the candidate. Complete result JSON is byte-identical: **143.15 / 143.2167 s** high/low, cure released, zero deaths, outcome hashes `d23478b9b16dd471` / `162c72fc08608d6f`. [Comparison](misc-30/evidence/finale-comparison.json), [results](misc-30/evidence/finale-timing.json).
- **Five first cold L10 loads on main:** **4960.5, 4877.9, 4844.7, 4844.1, 4945.9 ms**; median **4877.9 ms**, maximum **4960.5 ms**. Each sample used a distinct, fresh pooled Chrome process/profile and empty cache directory, real menu click to loading-card closure, native Metal WebGPU low, no menu delay or trace instrumentation, under an exclusive quiet reservation. All used the Apple adapter without fallback or console errors. The >6 s outlier did not reproduce, so no runtime load optimization was needed. [Summary](misc-30/evidence/cold-main/L10-webgpu-low-summary.json), [five-process provenance](misc-30/evidence/cold-main/provenance.json), [quiet conditions](misc-30/evidence/cold-main/conditions.jsonl). An earlier interrupted set produced one valid **4893.2 ms** sample; its data and pool context-disposal error are retained separately. The harness now awaits context disposal before the next fresh-browser launch.
- **Checks:** `npm test` **106/106**, no new test cases; `npm run verify -- E32` passed typecheck/lint/unit checks. Smoke **6 QA + 1 public** passed in **138.9 s** (240 s budget); private port 4342 avoids the occupied shared preview port. Scene gate **48/48**, 0 known, 0 not run, four successful batches with at most two workers. [Verifier](misc-30/evidence/verify.json), [smoke log](misc-30/evidence/smoke.txt), [scene summary](misc-30/evidence/scene-gate-summary.md), [full scene log](misc-30/evidence/scene-gate.txt).
