# s224 L8 animal looks — work in progress

The requested scope names seven asset IDs: `inf.lion`, `inf.lioness`, `inf.flamingo`, `inf.zebra`, `inf.gorilla`, `inf.monkey`, and `inf.elephant`. Lioness and monkey are derivatives of lion and gorilla respectively; both still require separate game-camera review.

## Evidence and open work

The current zoo skin builder applies authored infection colours to TRELLIS-derived sources. Existing reviews do not establish the requested old/new comparison at zoom 1 and 1.5, every LOD and both quality tiers for all seven IDs. In particular, the zebra notes describe a desaturated atlas with red eyes; the PO screenshot explicitly rejects its zombie read. Do not treat existing reviews as acceptance of this request. Generate and inspect the combined sheet, improve each failing variant, and record actual triangles and bytes per tier against the pre-change files. Confirm rigs and motions after rebuilding.

The corpse layout is presentation code in `src/render/characters/CorpseLayout.ts`. Normal candidates sample navigation clearance along a conservative footprint, but the fallback calls `evaluateCandidate(..., false)`, which skips that clearance, and the final fallback can retain a rejected footprint. This is a plausible placement route to clipping, not yet a reproduction of the reported zebra screenshot. Reproduce beside an actual L8 fence, inspect the selected path and rendered footprint, then fix and verify clearance without removing corpses. Check whether the zebra silhouette is damaged in a static bind pose and in animation before attributing it to decimation.

At revision `f7f41a1c`, the focused scene gate selection (`animal-zoo-healthy`, `night-boss-lion`, `foot-slide-flamingo-day`, `foot-slide-flamingo-night`, `flamingo-flock-contact`) passed 14/14 rows. This selection does not cover all animals or prove appearance. Typecheck and lint passed; remote `npm test` passed 105 tests with one skipped (198.2 s). These are baseline results and must be repeated after changes.

## Current baseline observation

A fresh `tools/qa/zoo-delivery-ab.ts` capture at zoom 1.5 drew the healthy and infected zebra in HIGH and LOW. I opened the HIGH zebra image: the infected animal reads mostly as a dark striped zebra from this view, with no clearly visible red wounds or bloody muzzle at the displayed scale. The outline has angular protrusions around the head, but this single view cannot distinguish geometry from a pose issue. This confirms the need to change and inspect the asset. The capture process stalled after the HIGH mixed scene and was interrupted; its partial output is under `test-results/followups-25/zoo-ab/s224-baseline/` and is not a completed acceptance sheet. It compares healthy with infected, rather than old with new, and omits lioness, monkey, zoom 1, and explicit LOD coverage.

## Runtime baseline budget (before this fix)

Measured from every mesh primitive in the current skinned HIGH GLBs with `assetIO`; bytes are standalone HIGH / LOW file sizes. These are the maximums for the requested replacement, even where the manifest allows more. LOW geometry must also be measured after replacement. Values include all exported mesh primitives, including eyes and hidden parts.

| Asset | LOD0 triangles; bytes H/L | LOD1 triangles; bytes H/L | LOD2 triangles; bytes H/L |
| --- | ---: | ---: | ---: |
| lion | 4,177; 86,192 / 86,192 | 2,136; 59,868 / 59,868 | 945; 50,600 / 50,600 |
| lioness | 3,837; 82,092 / 82,092 | 1,944; 57,512 / 57,512 | 873; 49,616 / 49,616 |
| flamingo | 1,835; 185,732 / 126,420 | 759; 79,536 / 79,536 | 316; 68,132 / 68,132 |
| zebra | 5,846; 349,184 / 213,428 | 1,762; 133,520 / 133,520 | 647; 107,576 / 107,576 |
| gorilla | 7,380; 407,496 / 307,040 | 2,807; 190,052 / 190,052 | 986; 111,844 / 111,844 |
| monkey | 7,644; 383,944 / 312,356 | 2,975; 188,868 / 188,868 | 1,074; 107,568 / 107,568 |
| elephant | 7,494; 262,868 / 216,496 | 2,873; 130,564 / 130,564 | 972; 77,884 / 77,884 |

The runtime zebra provenance in `assets/inf.zebra/provenance.json` pins its TRELLIS source and production rig hashes. The old external exporter path named there is absent at the recorded location; find or reconstruct the rig-preserving texture build before modifying its output. The other five main zoo sources have existing colour painting in `tools/assets/skin-crowd-animal-infection.ts`; lioness and monkey derive from those runtime skins via `tools/assets/build-l8-monkeys.ts`.

## Zebra candidate

The candidate repaints the existing TRELLIS-derived skin with flank/back wounds and muzzle blood, and tapers the high mane vertices in the bind mesh. It retains the original skin and animation names and triangle counts. The regenerated crowd bakes are necessary to show the changed geometry. `node --import tsx tools/assets/paint-zebra-infection.ts` rebuilds the six GLBs from the pinned pre-change revision; byte-for-byte reproduction was checked. Its outputs are staged in a temporary directory and must be copied and rebaked deliberately. The resulting LOD0/1/2 HIGH sizes are 329,028 / 119,888 / 94,380 bytes; LOW 198,920 / 119,888 / 94,380 bytes. The separate crowd bakes increased by approximately 2.7 KB each.

The rebaked HIGH side view at zoom 1.5 shows a smoother mane and visible red wound/muzzle. The HIGH WebGL2 `r32-zebra-game` scene passed 640 frames; its sheet was opened, but the small crowd frames do not establish detailed deformation quality. Typecheck and lint pass. This is a work-in-progress candidate: review both tiers, both requested zooms and all LODs side by side with the old animal, confirm motion and corpse/fence behavior, and rerun all gates after the remaining animals are changed.

## Lion source discrepancy

The current lion and lioness are not the wave-2 TRELLIS meshes: `docs/reports/r36-lion/README.md` records a later Blender-built replacement of their bodies, with the existing skeleton and animation retained. The current lion LOD0 is 86,192 bytes; rebuilding `amb.lion` from wave 2 as `inf.lion` produced 383,508 bytes after lossless consolidation, exceeding that baseline. That trial was reverted. A compliant replacement needs a TRELLIS-derived version fitted to the later, approved long-bodied cat and reduced to the current budgets; simply rerunning the old wave-2 build loses the r36 proportions and exceeds the file limit. The current HIGH game-camera lion view also has little visible wound colour at the observed angle. Lioness must be reviewed separately.

## Corpse reproduction

On the zebra candidate, `E2E_PORT=5231 SCENE_PORT=5232 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/r27-zoo-corpses.ts high webgl2 s224-corpse 1.5` completed with no reported browser errors. I opened both captures. In the plain-kill image, zebra bodies overlap the black fence bars; the blast image also shows bodies overlapping the wooden barrier, although the blast can change the barrier. The fixture spawns seven infected near the real L8 entrance and kills them, so this demonstrates a visible overlap in that setup, but the images do not isolate the rendered frozen position from simulation or establish whether the fence has a navigation collider. Trace those positions and collider identities before changing placement. The captured files are under `test-results/r27/s224-corpse/L8-high-webgl2/` and are not the required combined animal comparison sheet.
