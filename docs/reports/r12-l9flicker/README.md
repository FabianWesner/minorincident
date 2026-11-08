# L9 / L10 ground flicker

**Status: implementation and code checks complete; final visual verification blocked by Chromium launch permissions after the restart.**

## Cause and fix

Both reports reproduce on baseline `9c35d409`, which already includes the r10 fires/flares and E25 lighting changes. At the L9 start, the pale farm track is at `y=.0012` and the dirt shoulder at `.001`: a 0.2 mm gap. Other tracks are exactly coplanar with drainage strips. The shoulder also overlaps asphalt with only 1 mm clearance. Disabling the sun shadow and coarse horizon retained the bands, isolating the detail ground geometry.

L10 has the same class of overlapping verge/pavement faces near street lamp `1533`. The newer runtime forecourts are farther east than the reported campus location.

The layout build now assigns stable depth priorities to overlapping ground faces across all loaded base/wear tiers. Equal heights use a deterministic palette order. Materials receive four depth-buffer units per priority on both backends. Authored surfaces and collision heights are unchanged; triangle counts are preserved. Compression validates each semantic node’s bounds within the existing 1 cm tolerance. Terrain batching and both material caches retain the priority; the final cache was originally collapsing every terrain priority back to zero.

Runtime forecourt paving, puddles, decals, footprints, toxic masks, fire/flash pools and wet-light streaks use the shared policy above the reserved baked range. Weather puddles are part of the surface shader. LightField masks and interaction/move markers disable depth testing; they cannot fight the ground depth buffer. Fairhaven's service-yard slab/joints already have distinct heights.

## All-level guard

The existing unit case now checks exact-height ties, disjoint faces, material/batch priority preservation and every district's combined base/wear GLBs, including W6. The geometry audit examines horizontal upward faces at all heights. It rejects differently colored overlapping faces within 2 mm unless their material priorities separate them. Sub-5 mm edge aprons and intersections smaller than .01 m² are excluded.

| District | Baseline unsafe triangle pairs | After |
| --- | ---: | ---: |
| D-CROSSING | 2670 | 0 |
| D-CURE | 2512 | 0 |
| D-FAIR, including W6 | 12 | 0 |
| D-ZOO | 9 | 0 |
| Other ten districts | 0 | 0 |

These are intersecting triangle pairs, not a count of distinct visible defects. [Baseline audit](ground-before.json), [current audit](ground-all-heights.json), [reproduction script](baseline-audit.ts).

The build also regenerates D-CROSSING's streamed assets, and compression compares the bounds of each semantic glTF node rather than unstable material-primitive child names.

## Visual verification

The reserved post-restart batch reached its exclusive slot, but Chromium failed before opening a page: `bootstrap_check_in ... MachPortRendezvousServer ... (141)`, followed by SIGTRAP and `kill EPERM`. See the [launch failure](browser-blocker.log). An OS/bootstrap or sandbox restriction needs an unsandboxed parent session. The [single sheet](comparison.jpg) contains only the three baseline views; there is no verified after row. Baseline L9 series recorded 30 consecutive rendered frames on each backend: [WebGPU high](before-webgpu-high.json), [WebGL2 low](before-webgl2-low.json).

The [capture script](verify-capture.ts) uses [L9's reported pose](l9-start.json) and [L10's reported pose](l10-campus.json), records 30 real RAF frames, verifies nonzero priorities survive runtime sharing, and checks 18 L9 / five L10 corner positions. L10 is a geometry/lighting fixture at the reported position and zoom, not a replay of the full mission checkpoint.

## Checks

Post-restart checks:

- [Typecheck](typecheck-final.log): pass.
- [Lint](lint-final.log): pass.
- [Unit suite](unit.log): 107/107 pass, 109.7 seconds; repository budget 150/150 cases.
- [Focused ground regression](ground-test.log): 5/5 pass.
- [Combined geometry audit](ground-all-heights.json): pass across all 14 districts and all wear tiers.
- [Streamed terrain](terrain.json): layout/source hashes match; L9 max 300 triangles/cell and 9904 horizon triangles; L10 max 655/cell and 2340 horizon triangles.
- Scene gate and final visual verification: blocked by the browser launch failure. The pre-restart gate was interrupted; the post-restart batch stopped at its first Chromium launch.

The initial resource-constrained unit attempts timed out; the complete rerun above passed. No deployment or push. Raw pre-restart captures, traces and temporary baseline GLBs were removed after the disk-space alert. Only one browser is requested at a time.


## Finish verification outside this launch context

From this worktree in the unsandboxed orchestrator or a normal Terminal session:

```sh
sh tools/e2e-lock.sh sh docs/reports/r12-l9flicker/capture-batch.sh
```

The [batch](capture-batch.sh) reserves the supported external exclusive slot, runs the three captures sequentially, then runs `npm run scene:gate -- --jobs 1`. Every browser is headless and closes before the next opens. No additional build or worktree is created. The capture validates actual backend/tier, consecutive render-frame counters, retained runtime priorities and the exact reported L9 track pixel. Its output needs visual review before this goal can be marked complete.

The source fixes are committed in `0152c49a`, `19b18704`, `02086d3b`, `f940a6cb` and `b4a42010`; `be936ebe` is the orchestrator's restart snapshot. Historical `test-results/` deletions requested during disk cleanup remain unstaged.
