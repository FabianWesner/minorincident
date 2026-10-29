# Q-231 P3 follow-ups

Branch `lane/q231-p3`, based on main `763b56c87`. Original report and unchanged source images: [nightly-28 follow-up](../nightly-28/followups/q231.md).

## L9: reproduced and corrected

The existing real-input Q-221 drive reproduces the original frame exactly at tick 90: APC `(51.4885,-17.36)`, yaw 0. The two wooden pallets are `prop.pallet:3767` at `(48.759,-21.037)` and `prop.pallet:3769` at `(50.584,-21.261)`. They are movable prop entities (cropped scene active entities decrease from 24 to 22 after removal). The straight drive does not collide with them, but the screenshot shows the reported visual clash at the rear. Both are inside the route-to-detour maneuvering strip that Q-221 already cleared of trees.

The authoring cleanup now excludes wooden pallet footprints from that same strip, including its existing 2.5 m hull margin. Rebuilt the D-CROSSING layout and base GLB; the same rule clears 44 wooden pallets across the three bypasses, including the exact reported pair, retaining dressing beyond those driveable strips. [Placement receipt](evidence/l9-clearance.json).

Viewed the matched full-frame [before](evidence/l9-before.png) and [after](evidence/l9-after.png). Before: two pallets project against the rear hull. After: the rear hull and bypass are clear; road furniture, lighting, vehicle pose and camera match. The actual W-key drive retains exactly the same 31 sampled transforms and reaches `(64.9798,-17.36)` at tick 150, 1000 HP, with no console errors in either run. [Before trace](evidence/l9-before-trace.json), [after trace](evidence/l9-after-trace.json).

L1 and L10 targeted attempts and final checks are in progress.
