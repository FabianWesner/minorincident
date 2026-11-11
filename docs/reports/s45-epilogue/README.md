# S45 Epilogue

## Changes

- Reduced and darkened the panorama tide clouds in `LevelTenOverview`; their broad transparent pale-green overlay was washing out the landscape during the cinematic pull-out.
- In the closing presentation, align the corgi's animated head to a point over the courier's near knee. This is a render-only root translation and does not modify shared clips or simulation state.
- Added `tools/qa/s45-epilogue-capture.ts` to capture the Scene Lab epilogue fixture at zoom 1 and 1.5, low/high quality, and WebGL2/WebGPU. It writes to ignored `test-results/`.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 107 tests in 27 files; test budget reports 150/150 cases.
- `sh tools/remote/run.sh "$PWD" -- npm test`: not run remotely; no healthy Hetzner runner is provisioned and the Mac fallback was not selected.
- Scene Lab captures: not produced or opened. The required browser pool could not bind its local daemon socket (`listen EPERM` on 127.0.0.1:4329); the legacy headless launcher was also blocked when its GPU guard invoked `ps` (`Operation not permitted`).

Before/after visual review remains outstanding for both zooms, both quality tiers, and both backends. The capture runner defaults to saving four frames per combination (`pullout-start`, `pullout-mid`, `pullout-end`, `closing`) and records browser errors in `receipt.json`.

## Unrestricted environment follow-up

The first WebGL2/high/zoom-1 capture run completed after sandbox removal. Opened `pullout-start.png` and `closing.png`: the fixture shows an awaiting-rescue corgi status and the later frame is covered by credits. These images do not establish the closing pose or panorama acceptance. The fixture/setup and capture timing need repair before the full before/after matrix. Prior browser and Git permission blockers are resolved.

The follow-up capture explicitly retains a corgi actor and confirms the HUD now reports it following. Opened the resulting closing frame: the cinematic still is not framed. `SceneLab.applyCamera()` calls `view.follow()` on every epilogue fixture camera application (SceneLab.ts ~833), overriding the cinematic camera. Next capture pass must use the real campaign save replay rather than this isolated fixture path.

Real-save replay now launches without the isolated Scene Lab camera. The tracked fixture's obsolete resume is salvaged away by `decodeSave`, so its first opened image showed the level start. The QA runner now explicitly loads the current `cure-disperse-ready` checkpoint before staging the epilogue. Visual acceptance is still outstanding.

Opened the current-checkpoint replay's closing and pull-out images. The panorama is now captured correctly. The first closing adjustment visibly wedged the dog between her legs; the side-placement follow-up draws both figures separately but the head remained too high. Corrected the presentation to lower and bow the head toward the near knee; the final lowered pose still needs a fresh opened capture. No completion claim is made from the earlier images.

## Paired matrix completed

Produced 16 campaign-checkpoint runs (before/after × WebGL2/WebGPU × low/high × zoom 1/1.5), each with closing, middle-pull and ending-pull frames. Baseline renderer files were read from fc167cd0; current renderer files were restored after the batch. Opened `test-results/s45-epilogue/closing-pairs.jpg` and `pullout-end-pairs.jpg`, containing all eight pairs each. The panorama pairs show the broad pale green patches reduced while the green release column remains. Closing pairs consistently move the dog from the courier's front to beside her near knee. The full-resolution lowered-pose WebGL2/high frame was also opened. Close contact/clipping and a later resting-pose sample still need qualification, as do final validation commands after the pose changes. Raw captures remain ignored outside Git.

## Stability and final-check follow-up

Added a second closing sample one second later and opened it. This caught accumulated head rotation in the presentation overlay; rotation now uses a stored starting angle rather than subtracting each frame. Opened the corrected later image: drift is gone, but head/knee contact still needs closer review and is not accepted yet. Typecheck and lint passed during this follow-up. The requested remote `npm test` ran on 94.130.181.173; render-contracts passed (14 tests), but the overall run failed its 240-second time budget at 245.4 s / exit 124. It is not a green remote suite. The remote snapshot preceded the final rotation-drift correction.

Joint measurements from the rendered rigs identified the near knee at approximately (4000.013, 0.597, -32.881). The previous lowered head was (4000.1, 0.339, -32.7), contradicting contact. Corrected head placement measures (4000.01, 0.616, -32.88), within 2 cm of the knee joint. Opened its later closing frame; both are drawn, but the muzzle is still too upright, so the head pitch was increased toward a horizontal rest. That final pitch requires capture review. The QA runner now saves joint positions for evidence.

Opened the larger-pitch frame and found the head was turning sideways. Inspecting `assets/char.corgi/build.py` confirmed Blender local axes are retained: local Y is the pitch axis, local Z is yaw. Corrected the bow to local Y. The opened corrected-axis frame also showed that aligning the neck/head joint directly to the knee pushes the muzzle into her lap; moved the joint 40 cm outward so the muzzle can reach the knee. This latest muzzle-contact placement still requires an opened capture.

Opened the latest outward-muzzle placement. It still reads as looking up beside her, so it is explicitly not accepted as head-on-knee. Added head local-axis endpoints to the joint receipt to resolve the drawn rig's orientation before any further angle tuning. No further render changes were made from this capture.

Rendered axis receipts corrected the earlier Blender-frame assumption: local X is muzzle-forward, local Y is vertical, local Z is lateral. Removed the accidental head yaw and applied a shallow local-Z bow. Opened `render-axis-fixed/.../closing-late.png`; its forward unit direction is approximately (0, -0.13, -0.99), correctly toward the near knee. The muzzle reaches the knee region without accumulated rotation. The stair railing still overlaps the corgi's body/backpack in this view, so the no-clipping requirement remains open and the goal is not complete.
