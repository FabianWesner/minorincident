# L9 vehicle: Q-238 / Q-239

## Q-238: streaming fixture drives off its road

The original `qa-l9-q3-stream-retire` trace is straight and stable until frame 1575 at (357.84, -330.14), where the APC hits `prop.garden-bush-small:3319/geometry-0` (bounds x=360.69..361.96, z=-329.08..-327.72). The road turns at (350, -330), but the fixture kept driving straight to (450, -330). This is a real collision with verge dressing, not a streaming physics step or lost ground. `SimWorld.loadComposition` already installs a full-district permanent ground plane.

The fixture now drives the same 520 m on the straight road segment from (-270, -330) to (250, -330), with the same 4,200 frames and three infected at the same positions relative to its start. Streaming retirement, LOD swaps, nearby crowd, and every inherited limit are retained. No runtime handling or threshold changes. Headless pooled WebGL2 high: slip **80.1° → 0.4°**, limit **20°**, no console errors. See `stream-checks.json`; full traces/sheets are in `test-results/l9-vehicle/{baseline,stream-fixed}`.

## Q-239 and release checks

In progress.
