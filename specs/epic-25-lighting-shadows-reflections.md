# E25 · Lighting, Shadows and Reflections

## Goal
Put the five-layer lighting system from [06-lighting-shadows-reflections.md](06-lighting-shadows-reflections.md) into practice: emissive + bloom, the **light field**, **hero lights** with shadows, volumetric beams and flares, and reflections. Lights are driven by light anchors exported from Blender, with power groups, behaviors, and quality tiers. The showcase is the **light-tower trailer at night** (`light-lab` scenario).

## Depends on / Enables
E02, E10, E17 / every level's time-of-day preset, the L5 sunset, the L6 subway power failure and night exit, E27 (fire and explosion light).

## Scope
**In:** a spike comparing `ClusteredLighting` vs `DynamicLighting` on WebGPU and the AgX vs ACES look; the `LightSystem` (registry of light anchors from GLB extras); the light-field pass and its `PaletteMaterial` sampling (ground, walls, characters, fog); hero-light selection with hysteresis and crossfade; spot and directional shadow budgets; static light visibility polygons (from the layout build); blob and contact shadows; baked-AO consumption + GTAO; beams (cone shader, dust motes, depth fade); LensflareMesh glints; GodraysNode (golden hour); material classes (`matte`, `gloss`, `metal`, `glass`, `wet`); env PMREM per time of day; the wetness mask + reflection splats; SSR (high); interior-mapped windows; planar water (high); power groups and light behaviors (startup, flicker, break, rotate, strobe, transient pulses); light palette tokens; `light-lab`, `reflection-lab`, and `night-street` scenarios; Blender night previews (`render_preview.py`) and the in-game night turntable.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Tracks.js`](../folio-2025/sources/Game/Tracks.js): moving local orthographic RT → **light-field pass** technique
- [`Materials.js`](../folio-2025/sources/Game/Materials.js): emissive luminance normalization
- [`Materials/MeshDefaultMaterial.js`](../folio-2025/sources/Game/Materials/MeshDefaultMaterial.js): add light-field sampling + material classes
- [`Ligthing.js`](../folio-2025/sources/Game/Ligthing.js): shadow fitting to the optimal area, tinted shadows
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): instanced lamps, emissive glass, day/night switching, fireflies
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): headlights, brake lights, blinkers
- [`Rendering.js`](../folio-2025/sources/Game/Rendering.js): bloom setup
- [`Fog.js`](../folio-2025/sources/Game/Fog.js): lit haze
- [`Weather.js`](../folio-2025/sources/Game/Weather.js): wetness from weather overrides
- [`World/WaterSurface.js`](../folio-2025/sources/Game/World/WaterSurface.js): water reflections base
- [`World/Lightnings.js`](../folio-2025/sources/Game/World/Lightnings.js): arc light flashes

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E25-AC01 | The spike report (`test-results/epics/E25/spike.md`) compares the lighting options with perf counters and screenshots and records the decision; the code follows the decision | static/vision |
| E25-AC02 | Light anchors: every `light:*` empty in the exported GLBs parses into a valid `ss_light`; the validator enforces the §6 rules (emissive meshes referenced, spots hit the ground in range, palette color tokens, intensity 0–10) | static |
| E25-AC03 | Light field: in `light-lab` at night, the mean luminance inside the trailer's pool mask is ≥ 4× the luminance 3 m outside it; the pool ends at the fence (luminance behind the fence ≤ 1.3× ambient) thanks to the visibility polygon | visual |
| E25-AC04 | Light field works identically on WebGL2 and WebGPU: same photo spot, both backends, pool-mask luminance within ±10% | visual |
| E25-AC05 | Hero lights: the count never exceeds the tier budget (8/3 high, 3/1 low, as counted/shadowed); in a 60 s walk past 40 lights, promotions/demotions change ≤ 2× per second (hysteresis), and every change crossfades over 0.3 s (no pops: per-frame luminance delta at the pool center ≤ 15%) | e2e/perf |
| E25-AC06 | Hero shadows: a dummy standing in a promoted floodlight pool casts a shadow; the pixels behind it (away from the light) are ≥ 35% darker than beside it, and the shadow hue is tinted (230–290°), not black | visual |
| E25-AC07 | Generator power-on in `light-lab`: interacting with the generator emits `power.on{group}`; the lamps run the startup flicker (3–4 off/on transitions in 1.5 s, recorded from emissive state) and then stay on; `power.off` turns lights, emissives, beams, and pools off within 1 frame | sim/e2e |
| E25-AC08 | Breakable lights: one pistol hit breaks a `breakable` lamp (`light.broken`, sparks VFX, light off); infected sight range in that darkness drops by 40% (sim test) | sim |
| E25-AC09 | Beams: each spot with `beam` renders a cone that depth-fades where it meets the ground (no hard intersection line: the luminance gradient across the intersection band is ≤ 25% per pixel) | visual |
| E25-AC10 | Reflections on every tier: in `reflection-lab` (a wet street + neon sign + lamp), a reflection streak appears below each `reflect` light in the wet mask (luminance > 2× the dry neighbor) on **low and high**; with SSR on high, a car placed on the wet street shows a reflected silhouette (ID-pass mask overlap ≥ 30%) | visual |
| E25-AC11 | Material classes: car paint (`gloss`) shows a specular highlight and env reflection that move with the camera (two angles differ in highlight position), `matte` does not; chrome (`metal`) is env-dominant | visual |
| E25-AC12 | Interior-mapped windows show parallax depth: at two camera azimuths 15° apart, the interior back-wall pattern shifts relative to the window frame by ≥ 4 px; at night, windows of powered groups glow and unpowered ones are dark | visual |
| E25-AC13 | Night readability: in `night-street` (no practical lights near the player), the player mask has a luminance contrast ratio ≥ 3:1 against its 2 m ring (hero aura + rim); infected eyes are the brightest pixels of each infected | visual |
| E25-AC14 | Performance: `light-lab` and `night-street` within the tier budgets (E18), with the lighting passes reported in `perf()` (light-field ms, shadow maps count, hero lights count) | perf |
| E25-AC15 | Previews: `render_preview.py` produces day and night Blender renders for every light-bearing asset, and `assets:turntable` produces a night/lights-on view and an on-vs-off pair | e2e/static |
| E25-AC16 | Vision **checklist G (lighting)** passes for `light-lab` (vs `kf-light-trailer-night`), `l2-streets-w1` (vs `kf-l2-midday`), `l3-grove-boulevard` (vs `kf-l3-late-afternoon-smoke`), `l4-plaza-safe` (vs `kf-l4-safe-city`), `pair-plaza` in L5 (vs `kf-l5-sunset-ruins`), `l6-shelter-fails` (vs `kf-l6-subway-emergency`), and `mall-floor` (vs `kf-mall-polished-floor`) (spots updated for the 2026-10-07 level redesign) | vision |
