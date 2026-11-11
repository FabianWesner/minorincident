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
