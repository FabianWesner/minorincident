# R1 grade: golden morning, shared palette and lighting

Status: implementation complete. The 200-runner low-tier triangle budget and independent art-director score remain open. Inherited validation failures are classified as baseline and belong to main’s collision/navigation work.

## Changes

- L1 key `#ffd9b0`, saturated violet shadow `#6b4fc2`, no desaturation. Shared core-shadow edge uniforms are exposed. Surface colour is multiplied by shadow colour.
- Bruno's radial two-colour fog/background (`#f2c7a5` → `#c7a2c9`) replaces the flat horizon. Probe passes temporarily disable the background node.
- `worldLook.ts` defines the warm world palette. One nearest-filtered sRGB texture holds identity and world regions. L1 props/buildings sample world swatch indices; vertex-stage sampling preserves interpolation across coloured faces. Character identity swatches retain their own region. Hydrants retain saturated red; ordinary world reds are muted.
- Imported GLBs, vertex-colour variants, powered/unpowered static batches and vehicle paint use `PaletteMaterial`. Imported emissive variants, OPEN lettering on the diner door, window panes and other light surfaces emit at least 2. Infected eyes use normalized luminance 2 so red can cross the bloom threshold.
- Sun shadows use the actual visible ground corners ×1.1, normal bias 0.08, radius 2 and 2048 on high. A fixed, weighted 3×3 PCF grid replaces r186’s five randomly rotated taps, removing the filter’s per-pixel stipple.
- DOF uses 18 taps on high and 6 in a half-resolution render target on low; the protected survivor ellipse is retained. RTT disposal releases its shader material as well as its target.
- Soft radial contact footprints cover survivor, civilians, escorts, corgi and infected, including corpses. Their height follows the actual ground/support surface.
- Low-tier props use LOD2; buildings beyond 16 m use LOD2, reducing portrait V3 geometry without changing simulation.

No figure assets, `src/render/characters`, specs, reference assets or Bruno branded content were changed. Main was merged once at the start. Existing MIT notices were retained and updated.

## Validation

The focused unit suite loads L1 production world assets, adds their batches to a scene and walks every material. The WebGL2 browser audit also walks the runtime scene, including unused infected LOD slots. No plain Lambert/Standard materials remain.

Final typecheck, lint and build pass. Full unit: 152 pass / 1 baseline failure. Smoke: 3 unit and 22 browser checks pass. Grade/capture browser: 5 pass / 1 low-tier triangle-budget failure. E19: 35 pass / 2 baseline failures before its browser phase.

The browser suite checks HDR emitters and actual bloom-on/off output at V4, high/low DOF settings, and native-GPU headless rendering. The six fixed views are captured at 1600×900 high and 390×844 low, using the machine-wide e2e lock and two workers. Screenshots are reviewed locally against the mockup and PO Bruno capture, then deleted.

The 200-infected fixture starts runners in chase state and measures twelve seconds of live simulation. It retains high-tier simulation capacity while `debug.renderQuality('low')` changes only rendering. Normal low gameplay still caps infected at 100. This deliberate stress probe does not change campaign gameplay.

Final test counts and metrics are recorded in `r1-grade.json`.

## Local visual review

All six desktop/high and portrait/low views were compared with the mockup and PO Bruno reference using R0’s comparison sheets. This is a local implementation review; the independent reviewer’s harmony score remains pending.

- V1: peach siding, olive hedges and violet fence shade establish the warm morning palette. Window bloom is conspicuous and deserves art-director judgment.
- V2: lamp bloom and violet road shadows are legible on both tiers. Large lawns remain flatter than either style reference.
- V3: warm asphalt/sidewalk, peach blossoms and vehicle light bloom read coherently; the street still has broad uniform areas.
- V4: diner roof neon, window glow and vending illumination produce visible bloom. Characters remain readable among the clustered planters.
- V5: purple figure and lamp shadows remain clear across the crossing; the intersection is spacious and comparatively sparse.
- V6: amber storefront, muted coral vehicles, violet shaded surfaces and bright lights form a consistent palette. Low-tier hedge silhouettes are visibly simpler.

The final fixed PCF filter removes the observed edge stipple at both tiers; coloured asphalt/lawn shadows are clear at V1/V2/V4. Window bloom remains strong, with three visible emitter groups at V4 (roof neon, windows, vending display).

Figure proportions and world density remain visible reference gaps owned by other lanes. Stills cannot assess motion, and mobile emulation cannot certify physical-phone performance.

## Blockers

1. **Baseline:** Main's delivered `prop.hedge.glb` hash is `c15eef5fe18eaa2536beefe31c68bdf29abf840b54b35f008b217a4ebe872891`; generated collision data still records `2b4349a5df7ce64d07bf46c955ba5d4367797ea39b4357638d37a07e3fc9d2f5` for the hedge/tree alias. The unit gate fails. Collision regeneration was investigated and reverted because changing this lane's collision geometry would alter navigation.
2. **Baseline:** The M1-07 hedge string-pull navigation test fails with main's original collision geometry (arrival error 4.077 m in the isolated run). No simulation code was changed in this lane. Per orchestrator instruction, these failures are reported as baseline and left to the main checkout’s collision/navigation work.
3. With 200 chasing runners over 12 seconds / 720 simulation ticks, low rendering reaches 839,377 triangles against the 500,000 limit despite p95 4.2 ms and 58 draw calls. Desktop stress passes at p95 5.5 ms, 59 draws and 1,310,745 triangles. Delivered runner LOD2 alone is 4,308 triangles. Figure geometry belongs to the Opus lane; this lane does not simplify those assets.
4. Colour-harmony ≥8 requires the independent reviewer. The local comparison review is documented with final metrics; it does not substitute for that independent score.
