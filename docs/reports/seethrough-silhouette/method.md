# Retained occluder silhouettes

Solid reveal uses the existing ordered screen dither and opaque, depth-writing materials. The retained fraction is `0.35 + 0.65 * hole`: a fully opened hole keeps 35% of a solid surface. Layers use the same screen noise. Physical vehicles keep their existing camera-segment selection; scripted vehicles and props now use that same selection after their interpolated poses update. The ridden vehicle is excluded from fading.

Layered roofs reduced courier visibility when only the retained fraction was added. The final implementation also reuses the courier's existing foreground presentation whenever DistrictView identifies a camera-to-subject blocker. This restores the courier silhouette without reducing the retained surface fraction or changing the visibility gates.

## Vehicle coverage

`vehicleSilhouettes` lists Scene Lab vehicle IDs. The runner samples every frame, including frame zero and the last frame, regardless of contact-sheet thinning. It redraws the identical simulation pose three ways: normal reveal, the selected vehicle unfaded, and that vehicle hidden. Pending vehicle/LOD loads settle before its mesh shadow casters are disabled for all three passes and restored afterward. Original sheet/shot/video canvas checkpoints remain checked independently of the extra per-frame vehicle stops.

The unfaded-versus-hidden pixel mask defines the visible reference silhouette. A pixel differs when the sum of RGB channel differences is at least 36. Coverage is the fraction of reference pixels also present in normal-versus-hidden. A reference with zero projected visible pixels has no coverage requirement. Empty drawing-buffer reads throw instead of passing as an empty reference. Canvas reads occur in the same browser evaluation as screenshot readiness.

Every sample must retain at least 60% when camera segments miss the vehicle, or 30% when they hit it. Metrics retain each frame's reference count, retained count, blocker state and ratio. Existing courier-visible-share and cut-pixel gates keep their original thresholds. The solid-cut reference disables only the shared discard strength: it retains placement eligibility, interior visibility and courier foreground state. The old reference used the broader `seeThroughOff` setting, which also changes interior-placement visibility. The production convoy reported 3,200/407 outside pixels with that reference. The isolated-reference rerun was blocked by the admission limit, so that diagnosis/fix is not pixel-verified.

## Captures and performance

The required game/follow matrix covers high and low quality at zoom 0.5, 1 and 1.5; [matrix.md](matrix.md) separates completed cells from unmeasured ones. The original close-camera gate control keeps its authored lens; its existing follow-camera counterpart covers all three game zooms. WebGL2 uses native ANGLE/Metal; WebGPU must report its requested backend. All browser work is headless through the repository admission wrapper, on private ports 3377/3378.

Scene counters enforce draw/triangle limits. Scene `stepMs` includes submission and is not native frame-time evidence; native performance checks require their own quiet reservation. Full unit, sim and level suites run on Hetzner, with isolated unchanged retries for timed-out or contended timing checks. Earlier captures with an invalid probe or superseded presentation/fixture are kept under ignored `test-results/`, outside the final report matrix.

The final probe-readiness/video-checkpoint refinement passed its three tooling unit tests. Its browser rerun is included in the unmeasured matrix.
