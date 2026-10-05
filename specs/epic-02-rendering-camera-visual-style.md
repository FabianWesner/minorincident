# E02 · Rendering, Camera and Visual Style

## Goal
Give the diorama look of the drafts: WebGPU/WebGL2 renderer, the shared **palette material**, tinted shadows, bloom on emissives, fog, a time-of-day lighting rig, and the **high-angle narrow-FOV follow camera** with occlusion fading. All of it is built from Bruno's techniques (`docs/bruno-reference/threejs-and-visuals.md`).

## Depends on / Enables
E01 / E04, E10, E15, E17, E18.

## Scope
**In:** renderer bootstrap and fallback, render loop interpolation, palette texture and `PaletteMaterial` (TSL), lighting rig with time-of-day presets (`L1`…`L6`, `golden`), shadow fitting to the camera area, bloom, optional cheap DOF, the follow camera (focus smoothing, aspect adaptation, shake API, cinematic pose blending), occluder fading and roof hiding, `InstancedGroup`, named **photo spots** (`camera.preset(name)`), and a debug pane.
**Out:** district content (E10) and VFX particles (E15).

## Deliverables
`src/render/{Renderer,View,Lighting,PaletteMaterial,Materials,InstancedGroup,Occlusion,PostFx}.ts`, `src/data/palette.ts`, `src/data/timeOfDay.ts`, and the scenario `tests/fixtures/scenarios/lookdev.ts` (a test street with a house, fence, lamp, car placeholder, survivor placeholder, and 5 infected placeholders).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`View.js`](../folio-2025/sources/Game/View.js): follow camera, optimal area, aspect adaptation, roll, cinematic
- [`Rendering.js`](../folio-2025/sources/Game/Rendering.js): WebGPU pipeline + bloom
- [`Materials/MeshDefaultMaterial.js`](../folio-2025/sources/Game/Materials/MeshDefaultMaterial.js): PaletteMaterial base
- [`Materials.js`](../folio-2025/sources/Game/Materials.js): palette, emissive luminance normalization
- [`Ligthing.js`](../folio-2025/sources/Game/Ligthing.js): sun + fitted tinted shadows
- [`Cycles/DayCycles.js`](../folio-2025/sources/Game/Cycles/DayCycles.js): time-of-day keyframes
- [`Fog.js`](../folio-2025/sources/Game/Fog.js): fog
- [`Passes/cheapDOF.js`](../folio-2025/sources/Game/Passes/cheapDOF.js): tilt-shift
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): instancing
- [`PreRenderer.js`](../folio-2025/sources/Game/PreRenderer.js): shader pre-warm
- [`Viewport.js`](../folio-2025/sources/Game/Viewport.js): pixel ratio

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E02-AC01 | WebGPU is used when available; `?renderer=webgl` forces WebGL2; the selected backend shows in `perf()` and `getState().render.backend` | e2e |
| E02-AC02 | Camera defaults: FOV 25°, azimuth π/4 ±0.01, polar 0.30π ±0.02. The survivor's projected height is 1/14–1/10 of the viewport height at 1600×900 | e2e |
| E02-AC03 | Camera follow: after the player teleports 20 m, the camera focus converges within 1.0 s (sim) and never overshoots by more than 0.5 m | e2e |
| E02-AC04 | Portrait 390×844: the camera radius grows so a 12 m circle around the player stays fully inside the viewport | e2e |
| E02-AC05 | Palette coverage: every material in the lookdev scenario is a `PaletteMaterial` or explicitly `keep_`; the palette tokens match `01-art-direction.md` §3 | unit/e2e |
| E02-AC06 | Shadows are tinted: in the lookdev `shadow-probe` spot, the sampled shadow pixel has hue in 230–290° and is not pure black (L > 15%) | visual |
| E02-AC07 | Emissives bloom: a lamp head's pixel neighborhood brightness is greater with bloom on than off (mean luminance in an 8 px ring +10%) | visual |
| E02-AC08 | Occlusion: when a building is between the camera and the player, the building's occluding meshes get opacity ≤ 0.35 within 0.3 s, and the player silhouette stays visible (player-mask pixels > 70% visible) | e2e/visual |
| E02-AC09 | Time-of-day presets switch sun direction, colors, fog, and sky; screenshots for `L1, L4, L6` presets differ in mean hue and luminance by the expected ordering (L1 brightest, L6 darkest) | visual |
| E02-AC10 | Lookdev golden-hour screenshot passes the **North-star vision checklist** (`90` §7.1) against `initial-drafts/sunset-grove-combat-gameplay-mockup.png` | vision |
| E02-AC11 | Visual regression: lookdev photo spots `overview`, `street`, `shadow-probe` match the golden images within 1.5% differing pixels (threshold 0.1) | visual |
| E02-AC12 | Camera shake API: `shake(intensity)` is bounded (max offset 0.4 m) and disabled when settings `cameraShake=false` | unit |

## Verification recipe
```bash
npm run verify -- E02
npm run test:visual -- --grep @E02 --update-snapshots   # only when goldens are intentionally changed
```
Inspect `test-results/epics/E02/*.png` and write `review.md`.

## Notes / risks
In SwiftShader WebGL, bloom and shadows are slow but deterministic enough for goldens. Goldens are generated **only** with `?renderer=webgl&dpr=1` in the Playwright Chromium build pinned by the lockfile.
