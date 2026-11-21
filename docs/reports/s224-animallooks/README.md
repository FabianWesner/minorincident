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

The plain-kill fixture was repeated with an instrumented read of `CorpseLayout.place`: the zebra (`id 426`) settled at the same X/Z as its simulation root, approximately (3.947, 65.255), with yaw 4.711. The layout's three capsule samples all reported navigation clearance. The nearby `prop.crowd-fence:2388` is centered at (5.432, 67.1), yaw 0, scale X 1.0105. Thus the earlier image demonstrates screen-space overlap, not yet proven physical penetration. The placement footprint extends from Z 65.405 to 64.005 with radius 0.6; the rendered animal's frozen geometry needs to be measured against the fence before deciding whether this footprint is sufficient. The reproduction is not evidence about the separate PO paddock screenshot.

A subsequent world-space measurement decoded the delivered zebra crowd bake, evaluated `id 426`'s frozen `death-crumple` frame using the same skin matrices and settled yaw, and transformed its visible vertices to the traced position. LOD1 bounds are X 2.787–5.166, Y 0.135–0.915, Z 63.892–66.738; LOD2 bounds are X 2.837–5.164, Y 0.135–0.915, Z 63.899–66.657. The nearby fence's thin collision box lies at Z 67.075–67.125. Even the conservative LOD1 bounding box stops approximately 0.337 m before that plane, so this particular screen-space overlap is not physical fence clipping. A fixture at the reported paddock fence is still required; do not use the entrance screenshot to justify a placement change.

## Zebra paddock fence fix

A controlled real-L8 probe placed a zebra beside the west paddock fence at X=38 and killed it. Before the fix its settled root was (39.179, 32), and 89 visible LOD1 frozen vertices lay beyond the fence plane within the panel span and height (minimum X 37.810). The layout used the humanoid 0.6 m radius even though this pose extended 1.37 m toward the fence. The zebra now reserves a 1.4 m radius in the presentation layout. In the same fixture it settled at (39.767, 31.878), retaining the simulation position, and the opened after capture shows the head clear of the bars. This is a targeted fixture, not proof for every fence, pose, or animal; the no-valid-candidate fallback remains a limitation.

The focused `tests/shared/render-contracts.test.ts` passed 14 tests, including a new clearance regression; typecheck and lint passed. Before/after captures are in `test-results/r27/s224-paddock-trace/` and `test-results/r27/s224-paddock-after/`. The full remote suite and scene gates still need rerunning with all final changes.

## Checks after zebra and fence changes

The selected `animal-zoo-healthy,night-boss-lion,foot-slide-flamingo-day,foot-slide-flamingo-night,flamingo-flock-contact` scene gate passed 14/14 rows on the current changes (HIGH/LOW as listed, WebGL2/WebGPU). It does not cover all requested animal appearances. The full remote `npm test` was attempted three times unchanged; each hit the 240-second budget and exited 124 under elevated runner load. Completed cases reported no assertion failure, but none of these three runs is a passing full suite. Re-run the unchanged command on a sufficiently quiet worker after the remaining work.

## Gorilla trial

A broader dorsal wound was tried on the existing wave-2 TRELLIS gorilla through `skin-crowd-build.sh`. ETC1S q128 plus lossless buffer consolidation yielded HIGH 381,196 / 175,624 / 99,564 bytes and LOW 292,056 / 175,624 / 99,564, within the current GLB sizes. I opened the HIGH game-camera image at zoom 1.5: the patch remains too dark to read clearly against the coat at this angle. The trial was reverted. Future work needs a brighter, larger and carefully placed wound or exposed bone, and checks on all views, tiers and LODs; compression-budget compliance alone is not visual acceptance. The temporary image is `test-results/followups-25/zoo-ab/s224-gorilla-candidate/high-gorilla.png`.

A second gorilla trial enlarged the dorsal region and used a pale exposed center; the HIGH zoom-1.5 capture still read predominantly dark, with no clear exposed patch at the inspected angle. The trial fit the GLB budgets but was reverted. This suggests the chosen source-space region does not project strongly onto the visible surface or is lost in the runtime presentation; inspect the painted texels and rendered orientation before another colour-only iteration. Capture: `test-results/followups-25/zoo-ab/s224-gorilla-pale/high-gorilla.png`.

## Gorilla candidate

The L8 gorilla shader desaturated 88% of all atlas colours, including wound red. A selective red-pixel exception retains the dark neutral coat while letting wound colour through. The TRELLIS-derived skin now has a wider upper wound with red tissue and rib strokes. In the opened HIGH zoom-1.5 view (`test-results/followups-25/zoo-ab/s224-gorilla-red/high-gorilla.png`), the red area is visibly distinct from the healthy gorilla; the opened 720-frame HIGH WebGL2 `r32-gorilla-game` sheet shows it during motion and the scene passed. These views are not the full old/new LOD matrix. LOD0/1/2 remain 7,380 / 2,807 / 986 triangles; HIGH bytes are 383,424 / 176,852 / 100,548 and LOW 293,208 / 176,852 / 100,548, each below its baseline. Rebuild with `CROWD_Q=128 sh tools/assets/skin-crowd-build.sh /Users/wesner/Workspace/minorincident_3dpipeline/cast/wave2/amb.gorilla inf.gorilla`, then losslessly consolidate the six gorilla GLBs as in `tools/assets/compact-zoo-delivery.ts`. Typecheck and lint passed. Monkey remains a separate derivative requiring its own build and review.

## Monkey candidate

Rebuilt `inf.monkey` from the revised TRELLIS-derived infected gorilla using `CROWD_Q=128 BASIS=/Users/wesner/Workspace/minorincident_3dpipeline/vendor/basis-encoder-2.1 node --import tsx tools/assets/build-l8-monkeys.ts --infected-monkey-only`, followed by lossless meshopt consolidation of its six GLBs. The source pass preserves the monkey's thinned limbs, tail and rig while carrying the gorilla wound into its atlas. The opened HIGH and LOW zoom-1.5 views show red on the infected monkey's upper body against the brown coat; the healthy animal remains distinct. The opened HIGH WebGL2 640-frame `r32-monkey-game` sheet shows the pack moving and attacking, and the scene passed. These are not the full old/new LOD matrix.

LOD0/1/2 counts remain 7,644 / 2,975 / 1,074 triangles. HIGH bytes are 350,996 / 168,776 / 92,400; LOW 285,432 / 168,776 / 92,400, all below their GLB baselines. The separate new crowd bakes are 593,324 / 439,131 / 368,144 bytes, larger than their corresponding previous bakes; assess their aggregate delivery cost separately. Typecheck and lint passed.

## Flamingo candidate

The existing TRELLIS-derived flamingo already shows desaturated plumage and exposed red rib patches from the inspected sides. Added a localized blood tint to its bill. I opened the HIGH and LOW zoom-1.5 side views: the infected bird has visible ribs and a red bill against the pink healthy bird. The opened HIGH WebGL2 680-frame `r32-flamingo-game` sheet shows the flock in motion and the scene passed. These are partial appearance checks; the old/new all-LOD matrix remains open.

LOD0/1/2 counts remain 1,835 / 759 / 316 triangles. HIGH bytes are 162,492 / 73,864 / 63,184; LOW 113,096 / 73,864 / 63,184, all below baseline. Build with `CROWD_Q=128 sh tools/assets/skin-crowd-build.sh /Users/wesner/Workspace/minorincident_3dpipeline/cast/wave2/inf.flamingo inf.flamingo`, then losslessly consolidate its GLBs. Typecheck and lint passed.

## Elephant candidate

The existing TRELLIS-derived elephant has large exposed flank and back wounds. Added blood to the lower trunk, leaving the tusks ivory. The opened HIGH zoom-1.5 side view shows both red trunk tip and flank wound; LOW was captured as well. The opened HIGH WebGL2 680-frame `r32-elephant-game` sheet shows the wounds through the charge and attack, and the scene passed. This remains partial visual evidence; the old/new all-LOD matrix is open.

LOD0/1/2 remain 7,494 / 2,873 / 972 triangles. HIGH GLB bytes are 251,004 / 128,196 / 77,204; LOW 212,012 / 128,196 / 77,204, each below baseline. Rebuild with `CROWD_Q=120 sh tools/assets/skin-crowd-build.sh /Users/wesner/Workspace/minorincident_3dpipeline/cast/wave2/inf.elephant inf.elephant`, then losslessly consolidate its GLBs. Typecheck and lint passed.

## New TRELLIS lion reconstruction (not integrated)

A new imagegen reference was made from the current lion's game view, retaining its long body and adding wounds, blood and pale eyes. One sequential TRELLIS.2 inference was completed (1024, seed 42, 12 steps, 300k/2K). Durable input and high are in `/Users/wesner/Workspace/trellis-highs/s224-inf-lion/`; SHA256 input `39143868c18afa47ad3fd9a5fddd5eb6fb68c14ebfb09b922177d01741250fc3`, high `41d9c678bfc7e386c9660fb20711e3cca1ca01ead8cc52cb3fbe343cf5c963d6`. Charges were not exposed by the service. Pipeline work is isolated in `/Users/wesner/Workspace/3dp-s224-lion` on `lane/s224-lion`.

Solidified pre-binding bodies have 3,798 / 1,898 / 850 triangles, one watertight component, and minimum eight-view silhouette IoU 0.963 / 0.957 / 0.949 against the high. A trial rigged build had 3,988 / 1,997 / 916 triangles, but even with 256/128-pixel atlases and q128 the HIGH files were 129,916 / 79,704 / 52,088 bytes, exceeding the current 86,192 / 59,868 / 50,600 baselines. The opened HIGH zoom-1.5 side capture shows a long cat with wound colour but lacks verified glowing eyes and detailed deformation review. This candidate was not integrated; original game files were restored. Reduced unbound and trial rigged outputs are preserved under the durable high's `derived/` folder. Further work must reach all byte budgets, author eye placement, inspect all LODs and motions, and create a matching lioness. The temporary game capture is `test-results/followups-25/zoo-ab/s224-lion-recon/high-lion.png`.
