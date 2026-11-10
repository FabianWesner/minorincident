# r27-visp2: L8 zebra corpses, L8 monkey-arena canopy, L10 farmhouse cut

Findings from r26-vqa (batch 60). Contact sheet (images are git-ignored): scratchpad `r27-visp2/before-after.jpg` (rows: zebra corpse before/after, monkey arena before/after, L10 house before/after; framing differs a little per tile).

## 1. Dead zebras read as striped shards
Root cause (two parts, both in `src/render/CrowdView.ts`):
- A frozen animal corpse is baked from the LOD2 surface. Each LOD has its **own packed atlas and UV layout** (the three `inf.zebra*.low.glb` images differ), but the LOD1 (and LOD0) batch also re-bound the LOD2 corpse geometry to *its* atlas when it loaded (`crowdSurfaceBindings.set(body, surface)` ran for every LOD). As soon as a zebra was seen up close, its settled corpse sampled stripes from the wrong atlas: black wedges and torn patches, a "pile of triangles".
- The zebra's LOD2 is 647 triangles (thin leg and flank strips, hooves cut loose); even with the right atlas it read as paper-thin shards. Lions, lioness, gorilla, elephant, monkey and flamingo LOD2 are ~1000 triangles with vertex colours and read fine.

Fix: `corpseLod` is `lod1` for the zebra (1762 triangles, own atlas) and `lod2` for everything else; only the batch of the corpse's source LOD binds the corpse surface (`lod === corpseLod`, plus the unchanged human/alpha/dog/firefighter cases); the zebra's LOD2 load awaits its LOD1 batch so the corpse exists before the corpse pages are prepared. Corpses are never removed.

Checked (L8 real level, ids spawned and killed by `tools/qa/r27-zoo-corpses.ts`): single zebra live fall then frozen corpse, 8 zebras, and a mixed kill of all zoo species, plain and with rocket blasts. Lion, lioness, gorilla, elephant, monkey, flamingo corpses already read correctly (no change needed); zebra now reads as a lying zebra with mane and stripes.

## 2. Monkey arena canopy
`Foliage.setThinZone(x, z, r)`: inside a world disc the crown cards above 1.7 m keep only a sparse dither (about 42 % at the centre, a 5 m ramp to the rim). `GameView` drives it while the courier is inside an L8 enclosure (`l8BossArenas` centre/radius, +2 m), so the pack and the survivor group stay visible while the trees still read as trees (dithered, like the existing solid-occluder cut). Off everywhere else.

## 3. L10 farmhouse at the hide gap
The capture's building is `bld.cure-duplex` (887, 10). With see-through disabled (`R27_OFF=1`, `test-results/r27/l10-off`) the black polygon is still there: it is the **shadow-side gable wall of dark brick under the L10 night light** (pure black), with the window frames standing out on it, not a cut-away. The see-through disc only opens at the courier. Two changes:
- `src/render/district/InteriorLiner.ts`: a thin inward-facing room (walls, floor, roof underside, gable ends) inside the duplex shell, cut by the same courier disc, so a cut through the shell shows a finished interior instead of nothing (the shell is a closed box: far faces are back faces and were culled). Verified the courier stays visible (the first attempt without the disc cut covered her).
- NOT fixed: the shadow-side brick walls of the duplex are still near-black at night. That needs a lighting/art decision (a shadow-side ambient floor for L10 night buildings, or lighter brick AO), which touches every L10 building; left open for the orchestrator/PO.

## Verification
- low and high, zoom 1 and 1.5, WebGPU and WebGL2 for the zebra (single + group), canopy (WebGPU low 1.5, WebGPU high 1.5, WebGL2 low 1), L10 (WebGL2 high 1; WebGPU L10 not captured). Captures in the scratchpad `r27-visp2/` (`before/`, `after*/`, `canopy-*`, `l10-*`).
- `npx tsc --noEmit`, eslint on touched files: clean. `npm run test:gate` run remotely (result in the lane report).
- Not run: `npm run scene:gate`, all-levels A/B of the corpse-binding change (it only changes which LOD batch binds a non-human, non-alpha, non-dog corpse; check L1-L10 animal and dog corpses in the QA lane).

## Tools
`tools/qa/r27-zoo-corpses.ts` (`R27_ONE=zebra`, `R27_CANOPY=1`, `R27_L10=x,z`, `R27_DUMP=1`, `R27_OFF=1`), `tools/qa/r27-lod-tris.mjs`, scenes `tests/scenes/r27/`.
