# L9 vehicle: Q-238 / Q-239

## Q-238: streaming fixture drives off its road

The original `qa-l9-q3-stream-retire` trace is straight and stable until frame 1575 at (357.84, -330.14), where the APC hits `prop.garden-bush-small:3319/geometry-0` (bounds x=360.69..361.96, z=-329.08..-327.72). The road turns at (350, -330), but the fixture kept driving straight to (450, -330). This is a real collision with verge dressing, not a streaming physics step or lost ground. `SimWorld.loadComposition` already installs a full-district permanent ground plane.

The fixture now drives the same 520 m on the straight road segment from (-270, -330) to (250, -330), with the same 4,200 frames and three infected at the same positions relative to its start. Streaming retirement, LOD swaps, nearby crowd, and every inherited limit are retained. No runtime handling or threshold changes. Headless pooled WebGL2 high: slip **80.1° → 0.4°**, limit **20°**, no console errors. See `stream-checks.json`; full traces/sheets are in `test-results/l9-vehicle/{baseline,stream-fixed}`.

## Q-239 and release checks

The reported lamp is `prop.street-lamp:3780` at (185.152, -21.812). The headless keyboard probe starts at (186, -10), yaw 90°, then holds W for 300 ticks, W+D for 180, and S+A for 180. Before the fix, it catches the APC against this lamp and the adjacent bush: ticks 120–240 stay near (186.4, -18.8) at 0.13–0.17 m/s. The contact probe identifies the lamp by its collider centre. Reverse can recover it, but the pole obstructs the intended bypass. Before/after images were opened and reviewed (`captures/`); no console errors.

The existing tree/pallet clearance pass now also excludes street lamps from the driveable strips between each authored route and its detour. The deterministic layout rebuild removes 21 lamp placements, including :3780. Every remaining placement, route, anchor, surface, collider metadata entry, and terrain geometry hash is identical; the base GLB is rebuilt to match. No vehicle handling, collision thresholds, or playtest driver changes. In the matched post-fix probe the lamp contact is absent; deliberately driving farther into the hedge still stops the APC and reverse remains functional. `lamp-checks.json` retains the contact samples and exact layout diff.

Release checks are in progress. First full real-input L9 run: 136 s, finished, zero issues/deaths/skips/assists.
