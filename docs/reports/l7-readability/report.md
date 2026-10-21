# L7 height-step readability — PO 2026-10-20

Branch: `lane/l7-readability`. Exact PO player position: `(228.46, -4.92)`, feet on the lower ground.

## Changes

- L7 exposes the boundaries of the combined paving and walkable-solid height field with retaining faces and 32 cm pale stone caps. The caps use the existing `picketWhite` palette token, with local emissive bounce (0.30 on caps, 0.025 on faces); faces use `sidewalk`. Two merged mesh batches cover both quality tiers. Faces extend to the backdrop and sit 6 mm outward to avoid coplanar flicker. Both batches use the existing bounded courier reveal shader. Night lighting and grading are unchanged.
- RayCursor retains a live height sampler, seeds the first visible surface with a bounded scalar probe (at most 512 samples), and refines the plane intersection up to three times at the pointer position. The probe handles near-cliff and small-plinth clicks whose initial lower-plane hit falls beyond the raised surface. It uses retained math objects and no scene-mesh raycast. The scalar polygon lookup and shared empty bucket remove scratch-array allocations in its height-field queries.
- Health-bar occlusion now samples L7’s retaining terrain between the camera and the displayed figure centre, alongside the existing physics and visible-prop checks. The march stops above the highest authored support and runs with the generated retaining faces, so overhanging decks in other levels retain their exact solid-geometry occlusion.

## Height-step audit

Run `npx tsx tools/qa/height-steps.ts`; use `--without-l7-edges` for the geometry baseline. Coordinates and source IDs for remaining gaps are committed in [height-steps.json](height-steps.json); full baseline details are generated in `test-results/l7-readability/height-steps-before.json`.

The audit subdivides authored support/paving boundaries into segments no longer than 0.5 m. It samples both sides of the combined height field, ignores differences ≤0.3 m and wholly non-walkable voids, and tests the actual layout, terrain-chunk and placed-asset GLB triangles within 0.3 m. Quantized GLB coordinates are decoded before world transforms. Vertical faces and narrow pale rims qualify; navigation boxes alone do not prove a visible edge. L7 procedural wall triangles are inspected through the same triangle-distance test.

| Level | Exposed segments | Missing before | Missing metres | Main sources |
| --- | ---: | ---: | ---: | --- |
| L1 | 821 | 0 | 0.00 | — |
| L2 | 952 | 13 | 4.00 | Carried annex rubble |
| L3 | 2193 | 4 | 1.82 | Highway onramp endpoints |
| L4 | 943 | 11 | 5.25 | Town Hall support |
| L5 | 1045 | 35 | 16.31 | Crater 6 supports |
| L6 | 1933 | 509 | 253.46 | Shelter field perimeter, night-street apron, Northgate platform |
| L7 | 1897 | 831 | 414.31 | Northgate terrace sides/end and retained crater supports |
| L8 | 0 | 0 | 0.00 | — |
| L9 | 99 | 0 | 0.00 | — |
| L10 | 1666 | 15 | 7.07 | Cure lab support |

L7 has **zero missing edge segments after the change**. Other levels are listed for follow-up; the audit identifies geometry/support mismatches as well as absent retaining faces. It does not certify night contrast for those levels.

## Capture recipe

```sh
E2E_PORT=3835 SCENE_PORT=3836 L7_STAGE=before sh tools/e2e-lock.sh npx tsx tools/qa/l7-readability.ts
E2E_PORT=3835 SCENE_PORT=3836 L7_STAGE=after sh tools/e2e-lock.sh npx tsx tools/qa/l7-readability.ts
L7_STAGE=before npx tsx tools/qa/l7-edge-contrast.ts
L7_STAGE=after npx tsx tools/qa/l7-edge-contrast.ts
```

The comparison uses seed 2, six fixed viewpoints, zooms 0.5/1/1.5, high/low, and real Metal-backed headless WebGL2/WebGPU. The baseline disables only the new edge mesh, providing identical scene/lighting parameters. The original pre-change PO captures were also inspected while implementing. Renderer, quality, zoom and console errors are asserted.

Viewpoints: exact PO position; the same ledge from its upper side `(228.46, 3)`; Northgate south edge `(262, 29)`; middle south edge `(174, 29)`; terrace foot `(116, 1)`; and the retained city-centre crater support `(15, -14.73)`. At zoom 0.5 the ledge is outside the frame from the exact PO position, so the nearby upper-side view supplies the close-zoom check.

Contrast uses relative linear sRGB luminance and `(max(Lupper, Llower) + 0.05) / (min(Lupper, Llower) + 0.05)`, with median 3×3 patches. Upper-cap probes are at authored world coordinates, laterally clear of the courier; lower probes choose the nearest terrain-visible ground with clearance from the wall. DOM overlays, conservative figure bounds and the active courier reveal disc are excluded geometrically; samples are never selected by their measured brightness. Every sampled pixel coordinate is retained in `contrast.json`.

## Visual review and validation

All eight comparison sheets were opened and reviewed: WebGL2/WebGPU × high/low, at zoom 1/1.5 and 0.5. Raw 1600×900 PNGs are under `test-results/l7-readability/{before,after}`; committed contact sheets are linked below.

| View | Observation | Result |
| --- | --- | --- |
| Exact PO position | Before: the diagonal boundary reads as a dark colour seam. After: a continuous pale cap separates upper paving from the lower ground at both requested zooms. | PASS |
| PO ledge from its upper side | The close view now exposes an unmistakable border; at zoom 0.5 the cap remains wide and readable against the lower night ground. | PASS |
| Northgate south edge | The previous flat-looking boundary gains a tall purple stone retaining face with a pale top. The vertical drop is clear at zoom 1 and 1.5 on both tiers. | PASS |
| Middle terrace | Lit faces and the small rises in the cap reveal the terraced descent. High and low retain the same edge geometry. | PASS |
| Terrace foot | The shorter drop now has a distinct kerb and cap, including the shallow terrace notches. The courier’s bounded reveal opens locally while the edge remains readable around her. | PASS |
| City-centre crater support | The raised support’s rectangular walking boundary now has a visible rim and side. The dark crater silhouette remains distinct inside it. | PASS |
| Courier below the high edge | The courier remains visible through the existing reveal disc, with the ledge intact around it. See [courier reveal](courier-reveal.jpg). | PASS |

[WebGL2 high comparison](comparison-webgl2-high.jpg) · [WebGL2 low comparison](comparison-webgl2-low.jpg) · [WebGPU high comparison](comparison-webgpu-high.jpg) · [WebGPU low comparison](comparison-webgpu-low.jpg)

[WebGL2 high zoom 0.5](close-webgl2-high.jpg) · [WebGL2 low zoom 0.5](close-webgl2-low.jpg) · [WebGPU high zoom 0.5](close-webgpu-high.jpg) · [WebGPU low zoom 0.5](close-webgpu-low.jpg)

### Measured contrast

The final pass produced **72 after captures, zero browser errors, and 572 valid patch pairs across 68 frames**. Minimum contrast is **3.38:1**. The four exact-PO zoom-0.5 frames have no edge in view; the nearby upper-side camera supplies the close-zoom measurement. The raw coordinates, luminances and geometric exclusion masks are retained in `test-results/l7-readability/{before,after}/contrast.json`; compact results are committed as [before](contrast-before.json) and [after](contrast-after.json).

| View | Minimum final contrast across renderers, tiers and measured zooms |
| --- | ---: |
| Exact PO | 6.48:1 |
| Same ledge, upper-side close view | 3.38:1 |
| Northgate south | 5.36:1 |
| Middle terrace | 5.31:1 |
| Terrace foot | 5.53:1 |
| City-centre crater support | 4.39:1 |

### Survivor bars

The runtime fixture stages the current living group below the terrace and one control survivor above it. On each backend, all **23 high-tier / 14 low-tier hidden figures are inside the camera frame**, all their bars are suppressed, and the upper control retains its bar. This checks terrain occlusion rather than offscreen culling. [Fixture sheet](terrain-bars.jpg) · [IDs and in-frame checks](terrain-bars.json).

### Validation

- Typecheck, lint and production build: PASS.
- Focused cursor, step-boundary and bar-occlusion tests: **9 passed locally and remotely**, including raised→lower / lower→raised projection, retained hit object, sloped refinement, a near-cliff regression (6.69 m error before the first-surface probe), a small plinth, diagonal and unclosed boundaries, shallow/shared-edge exclusion, and the overhanging-deck guard.
- `npm run verify -- E29` simulation/smoke stage: **116 passed, 0 failed**, remotely.
- Still-capture maximum: **111/61 draws** and **245,336/104,015 triangles** high/low. The added geometry is two batches / 7,588 triangles on either tier.
- Remote `tests/unit tests/levels`: **2,138 passed, 0 failed, 11 skipped**.
- E29 native functional/browser stage: **40 passed, 14 failed**. All four high/low entry/pickup/checkpoint cases passed, as did the full real mouse/keyboard Northgate→horde→bus→L8 route and phone controls. Two failures came from the comparison fixture reading runtime-authored `pair-*` anchors from base JSON; the fixture now applies `levelFiveLayouts` and compares camera coordinates within 1e-10 m (the second attempt exposed 0.6 versus 0.6000000000000001), **both high/low reruns passed (2/2)**. The other 12 failures have zero courier ID-mask pixels at the horde point although the normal render shows her. A diagnostic confirms **zero pixels with the new edges enabled and disabled**; the rocket mask has 31,939/31,972 pixels respectively. This is an existing ID-mask failure independent of the added edges. [Probe results](id-mask-probe.json).
- The first software-rendered remote entry check hit its 180 s warmup limit; the identical native case passed in 15.2 s, and all four cases passed in the native stage above.
- Native performance timing: **unmeasured**. The verifier stops after its browser failures. A separate quiet-run attempt waited for browser admission while another long campaign playtest held a slot; it was cancelled before finishing this lane. No performance threshold was changed. The reported draws/triangles above are still-capture counters, not peak timing budgets.

No spec criteria were changed.
