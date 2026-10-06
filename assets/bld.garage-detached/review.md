# Asset vision review — PASS

Date: 2026-10-06. Reference: `reference-upscaled.png`, checked against the original sheet crop `reference.png`. Review comparison: `renders/comparison.png`. Five modeling/review rounds (blockout plus four refinements), including the final bicycle fit and window-aperture correction. No registration or commit is included in this asset job.

## Checklist C

- **PASS [must] Recognizable at gameplay distance.** The pitched garage roof, pale gable casing, open bay, blue-gray shutter, lit side window and paved apron remain readable in `renders/game.png` and the WebGL2 game-camera captures.
- **PASS [must] Main part layout.** The open workshop has the wooden counter/pegboard, hanging hand tools, red drawer chest on the left, stool and crates below, hanging bicycle and red mower on the right, side window, lamps, bins, fence and flowering vegetation. The bat lies on the workbench as explicitly requested, instead of leaning as in the reference.
- **PASS [must] Material separation.** Gray siding, dark shingles, pale trim, warm wood, red equipment, blue-gray bins/shutter, teal bicycle, green shrubs and amber lighting use distinct shared palette materials. The final window aperture exposes all four emissive panes without siding across them.
- **PASS [should] Hidden sides.** The side/rear views continue the same lap siding, overhanging shingled roof, corner trim and fence/shrub language; the roof-hidden view shows a complete workshop floor and enclosed side/rear walls.
- **PASS [should] Budget and shape quality.** LOD0 is 76,056 triangles and 34 draws, under the 100k/40 hero limits. Main forms have soft bevels; flat leaf facets are intentional low-poly details. LOD1 is 10.60% and LOD2 is 3.32% of LOD0.
- **PASS [must] No real-world marks.** No brands, logos, labels or text occur in the model.

## Technical verification

`model.glb`, `model.lod1.glb`, and `model.lod2.glb` are quantized and Meshopt-compressed. Final bytes: 1,134,144 / 197,684 / 87,964. All meshes have CPU-baked 32-sample AO in COLOR_0. Every material is a known `pal_*` or `emi_*` token and exports single-sided. Geometry is finite with zero degenerate triangles. See `validation.json`.

All LODs retain `root`, `body`, `roof`, `interior`, `door_main`, `window_side`, `weapon_bat`, `bat_display` and `entrySocket`. Named group/socket translations survive compression within 1 mm and match across all LODs. The shutter origin is at its upper track. `weapon_bat` sits at the lying bat's grip and its local +X follows the barrel. `bat_display` is independently hideable on pickup. Wall/floor collider empties leave the garage entrance and interior clear.

A second independent Blender build reproduced every LOD geometry hash (`determinism.json`). All final Eevee renders have backface culling enabled; `renders/cutaway.png` proves the roof/interior visibility split. The final high-resolution hero is 1600×900, 96 samples.

Headless Chromium / Metal WebGL2 loaded all three compressed GLBs with **no console errors or warnings**; stationary game-camera captures separated by 900 ms were byte-identical (`browser-audit.json`). The study viewer lacks a compression decoder, so `browser_audit.mjs` adds the production MeshoptDecoder only to its served response. Shared preview code remains unchanged. WebGPU is a manual check under repository instructions and was not run.

## Retained review images

- `renders/hero.png`, `turnaround.png`, `game.png`, `cutaway.png`, `comparison.png`: Eevee hero, four views, gameplay camera, roof-hidden interior and reference comparison.
- `renders/webgl2-hero.png`, `webgl2-turnaround.png`, `lod-comparison.png`: final compressed-runtime hero, four views and all LODs at the game camera.

## Documented simplifications and validation scope

The vignette uses rounded shrub cores and chunky leaf/flower geometry rather than the reference's dense fine foliage. Rear construction is inferred; foreground clutter is consolidated. Palette lighting makes the studio roof warmer than the neutral runtime roof. The shutter models the visible raised section, not a complete articulated closing simulation. These differences preserve the location's identity and its bat-pickup contract.

Typecheck and lint pass. Unit tests are 185/186: the unrelated audio-license test throws on an undefined `entry.parentPath` at `tests/unit/audio/assets.test.ts:56`. No test/audio code was changed. Full E17 registration/integration verification belongs to central reconciliation, because manifest and registry edits are excluded from this job.
