# bld.courier-depot — visual and delivery review

Reviewer: Codex, 2026-10-06. Verdict: **PASS** for authored asset delivery; manifest integration and manual WebGPU review remain with the integrator. Three visual refinement rounds. Source is the labelled courier depot on `initial-drafts/l1v2-neighborhood-kit.png`; crop rectangle [42,183,407,511]. Clean reference produced by one built-in imagegen edit, prompt archived in `prompt.md`.

Compared `reference.png` and `reference-upscaled.png` with final `renders/hero.png`, `renders/game.png`, `renders/turnaround.png`, and `renders/comparison.png`. Studio is Eevee, every exported material uses backface culling, hero render 1600×900/96 samples. `renders/pose-test.png` closes the hinge and hides the roof; `renders/night.png` checks interior/lantern emission and warm spill.

## Checklist C — asset

- **PASS [must], gameplay recognition:** teal/yellow scalloped awning, parcel-shop fascia, red drop box and busy parcel display remain distinctive at the high game camera.
- **PASS [must], main layout:** one glazed main entrance with hinge at its right jamb, fixed parcel-display glazing at left, pickup counter and POS inside at right, shelving behind; four sign lamps, HVAC and bent rooftop duct, A-frame, hand truck and parcels, flowering pots and conifer retain the source placement.
- **PASS [must], materials:** cream stone, warm wood/cardboard, dark rubber/lamp metal, red mail drop/hand truck, teal signage and yellow canopy use named palette tokens; `keep_glass` is transparent glazing preserved by runtime material policy.
- **PASS [should], hidden sides:** inferred rear is plain cream masonry; opposite side has a framed warm window consistent with the shop. Roof and interior remain separate removable groups.
- **PASS [should], budget/finish:** 94,686 shipped triangles, soft 2-segment bevels and smooth plant forms; small faceted lettering/foliage is unobtrusive at gameplay distance. Static draws 36, excluding 5 door draws, within the hero limit of 40.
- **PASS [must], fictional branding:** Sunset Parcel Co. and Sunset Grove are fictional; no real-world marks or character content.

## Functional and geometry checks

Every LOD retains `root`, `body`, `roof`, `interior`, `door_main`, empty `parcel_counter` interaction point, `entry`, and `window_display`, `window_entry`, `window_side`. Glazing in the entry follows the actual door hinge, not a detached root pivot. Rest door angle 65°; pose closes it to 0°. Six collider empties form the wall/counter shell and leave the entrance aperture accessible. Three light-anchor extras reference preserved named emissive nodes. All materials are palette tokens except allowed `keep_glass`; no image textures, NaNs, degenerate triangles, missing AO, missing functional nodes or double-sided materials in delivered GLBs. Sign plates, lettering, parcel labels and envelope relief have separate exposed depth layers; no visible coplanar flicker.

Repeated high builds separated by the medium/distant builds and AO produce identical canonical geometry hashes. The initial false mismatch came from Blender reordering its cached loop-triangle list; diagnostic rebuilds found zero vertex-coordinate or transform differences. Hashing now compares canonical coordinate/winding triangles, following production validation.

| Delivered tier | Triangles | LOD0 ratio | File size | Static + door draws |
| --- | ---: | ---: | ---: | ---: |
| model.glb | 94,686 | 100% | 704.7 KB | 36 + 5 |
| model.lod1.glb | 11,870 | 12.54% | 119.1 KB | 33 + 4 |
| model.lod2.glb | 2,052 | 2.17% | 37.4 KB | 23 + 2 |

The production optimizer supplies dedup/prune/weld/join, quantization, meshopt and removal of subprecision degenerate triangles; named joints, interaction anchors, window nodes and light emitter names stay addressable. `validate.ts` invokes the repository's production `validateDocument` with local authored dimensions, then checks AO, culling, compression extensions, light references and LOD ratios. All checks pass. Authored game-space bounds are approximately 4.550 × 4.310 × 5.266 m (X/Y/Z, Y up); include plants and sidewalk.

## Scope and visual deviations

Wing icons, chalkboard emblem, flowers and shelf contents use simplified geometric relief rather than textures. The unseen roof depth and rear/side layout are inferred; the sign uses Blender's built-in font for reproducibility. Colour choices follow the supplied palette (nearest teal/cream/wood tokens), so the generated reference's brighter cyan and more sculpted vegetation are not literal material matches. These preserve the main asset identity and game-camera layout.

Only this asset folder was authored. No manifest registration, public-model writes or commits. WebGPU requires the manual check specified in AGENTS.md. Headless WebGL2 checks use the existing :3300 server and inject production MeshoptDecoder into the viewer response only, preserving preview source files. Rebuild/pack/validation/capture commands are in `notes.md`; actual machine results are in `report.json`.

Final browser verification: all three **packed** GLBs decoded with MeshoptDecoder in headless real-Metal WebGL2, matching delivered triangle counts exactly, with zero console warnings/errors. Final browser evidence: `renders/webgl2-lods.png`. Only final proof images are retained; draft/intermediate renders and diagnostic scripts were removed.
