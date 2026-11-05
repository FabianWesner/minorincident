# Clinic annex review — 2026-10-06

Verdict: **pass for asset production**. The original crop and cleaned reference were compared with the final Eevee hero, gameplay camera, four-view turntable, night and interaction renders. Four modeling/review rounds; the final independent rebuild made no geometry changes. Registration and placement remain with central reconciliation.

## Deliverables and budgets

| Tier | Triangles | Ratio | Total draws | Static draws | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOD0 | 93,153 | 100% | 39 | 24 | 1,453,104 |
| LOD1 | 12,872 | 13.8% | 35 | 23 | 211,780 |
| LOD2 | 3,627 | 3.9% | 22 | 11 | 75,488 |

Hero is below the 100k building ceiling, 40-draw limit and 1.5 MB delivery limit. LOD1 is within 10–15%; LOD2 passes the project's 4.5% maximum and 4k triangle ceiling, with fewer than 12 static draws. Explicit closed geometry preserves the walls, roof, entrances and hatch. Tiny-part bevels, unreadable distant lettering, individual pavers and flower detail account for the progressive reduction.

Metres, Blender +X front/Z up, glTF +X front/Y up. Measured LOD0 bounds are approximately 7.887 × 5.215 × 9.700 m in game space. Each model contains palette materials, genuine deterministic CPU-baked AO, quantized vertex data and meshopt compression; no image textures. Every exported material is single-sided.

## Reference comparison — checklist C

- **Recognizable at gameplay distance: pass.** Compact cream annex, dark/teal clinic fascia and medical cross, cyan entrance, flat parapet, large HVAC and tall exhaust define the silhouette. The delivery facade reads from the game view.
- **Main part layout: pass.** Double glass entrance under the shallow teal canopy, narrow left glazing and stacked care notice, wall lamp/reader, side security camera, yellow biohazard panel, deliveries hatch/arrow, small bench, yellow bollards/dark posts, flower boxes and planted paving are placed as in the concept.
- **Material separation: pass.** Cream masonry, slate roof, teal enamel, silver door/hatch frames, brass pulls, cyan/amber emission, timber planters and green/pink/yellow planting remain distinct.
- **Hidden sides: pass.** The inferred rear uses the same plaster, a framed window and roof courses. A simple reception floor, desk and lab partition provide a plausible roof-hidden cutaway.
- **Budget and faceting: pass.** LOD0 retains the broad softened forms and purposeful mechanical, signage and planter detail. Faceted planting is intentional; coarse LOD crowns remain grounded and within the paving lot.
- **Fictional identity: pass.** Sunset Grove Medical Annex; no external brands or trademarks.

The source has denser, more organic flower/weed detail and more irregular wear. Those details are simplified. The palette glazing is opaque and emissive rather than translucent. Distant tiers omit text and petal detail that cannot be read at their intended screen size. These changes preserve the asset's identity and interaction cues.

## Runtime contract and validation

`root`, `body`, `roof`, `interior`, `door_main`, `door_main_right`, `door_delivery`, five independent `window_*` assemblies and the named lamp/cross assemblies survive optimization in every tier. The entrance doors rotate from their outer vertical hinges; the delivery hatch rotates from its bottom X-axis hinge. The delivery node includes `interaction: courier-delivery`, with a separate `delivery_interaction` empty outside it.

`fx_smoke` is at the capped rooftop exhaust mouth; `fx_smoke_window` is at the front glazing. Seven `light:*` anchors retain `ss_light`, power group `clinic-annex` and named emissive targets. `light:front` uses damaged flicker. Every emissive mesh is covered by an anchor. The roof hides with all of its mechanical equipment; doors and the hatch remain independently movable. `col:building` is a mesh-free exterior-envelope collider; detailed interior collision belongs to the district.

`validate.ts` decodes all three GLBs, calls the production `validateDocument`, and additionally checks AO, single-sided materials, emission references, sockets, bounds/ground contact, geometry, file/draw/triangle budgets and LOD ratios. All checks pass. Independent builds into `rebuild*.glb` and `selfcontained*.glb` produced identical geometry hashes for all tiers (`determinism.json`); temporary verification files were deleted afterward. build.py embeds the shared optimizer invocation, so rebuilding does not depend on ignored per-asset helper files.

All tiers loaded in **headless WebGL2 with Metal** using the production palette shader and lighting graph, with zero console warnings/errors and page errors (`renderer-check.json`). The study sun is rotated toward the reference facades; this does not change the asset or production lighting. The 135°/134.9° game-camera pair was reviewed for unstable overlays; lettering, panel joints, canopy seams and hatch trim remain stable. Door/roof interaction was reviewed in both Eevee and WebGL2. WebGPU was not automated, following the repository's manual-check rule.

`npm run typecheck` and `npm run lint` passed. Unit tests: 184 passed, 2 unrelated failures: an audio test accesses an undefined `Dirent.parentPath`, and full production asset validation timed out at 120 s on the shared machine. Details are in `checks.json`. No source, manifest, registry, other asset or specification changes were made by this job, and no commit was created.

## Retained review evidence

`renders/hero.png` (1600×900, Eevee 96 samples), `turnaround.png`, `game.png`, `night.png`, `interaction.png`, `comparison.png`, `lod-comparison.png`, `webgl2-review.png`, `webgl2-game.png` and `camera-stability.png`. Other intermediate/individual renders are removed. Asset materials use backface culling in every review render.
