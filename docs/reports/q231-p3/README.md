# Q-231 P3 follow-ups

Branch `lane/q231-p3`, based on main `763b56c87`. Original report and unchanged source images: [nightly-28 follow-up](../nightly-28/followups/q231.md).

## L9: reproduced and corrected

The existing real-input Q-221 drive reproduces the original frame exactly at tick 90: APC `(51.4885,-17.36)`, yaw 0. The two wooden pallets are `prop.pallet:3767` at `(48.759,-21.037)` and `prop.pallet:3769` at `(50.584,-21.261)`. They are movable prop entities (cropped scene active entities decrease from 24 to 22 after removal). The straight drive does not collide with them, but the screenshot shows the reported visual clash at the rear. Both are inside the route-to-detour maneuvering strip that Q-221 already cleared of trees.

The authoring cleanup now excludes wooden pallet footprints from that same strip, including its existing 2.5 m hull margin. Rebuilt the D-CROSSING layout and base GLB; the same rule clears 44 wooden pallets across the three bypasses, including the exact reported pair, retaining dressing beyond those driveable strips. [Placement receipt](evidence/l9-clearance.json).

Viewed the matched full-frame [before](evidence/l9-before.png) and [after](evidence/l9-after.png). Before: two pallets project against the rear hull. After: the rear hull and bypass are clear; road furniture, lighting, vehicle pose and camera match. The actual W-key drive retains exactly the same 31 sampled transforms and reaches `(64.9798,-17.36)` at tick 150, 1000 HP, with no console errors in either run. [Before trace](evidence/l9-before-trace.json), [after trace](evidence/l9-after-trace.json).

## L1: not reproduced after three targeted attempts

Kept the original reported dark triangle as a real unresolved P3. Reviewed all 15 new contact sheets plus the original enlarged crop. None shows the stretched dark triangle. No death animation or body mesh was changed.

The production L1 cast was loaded first; each model reuses the nearest campaign civilian's recorded ID, tint and accessories. Its normal production infection transition is followed by the hit at frame 5, outside the fire-station shutter at `(-74.4,40.9)`, with the courier at `(-76.16,41.17)`. All 91 ticks (0–90) have raw captures and actor/model/health/death tick/clip/phase/LOD records. The committed compact receipts retain every tick, its scene spec and campaign source actor; raw full frames/joints are under `test-results/q231-p3/l1-campaign-models-{1,2,3}`.

| Attempt | Targeted condition | Observed drawing | Receipt |
| --- | --- | --- | --- |
| 1 | Low, original zoom 1.5; lethal heavy hit from courier | actor 4, `death-back`, LOD1 → LOD2 | [tick log](evidence/l1/attempt-1.json) |
| 2 | Low, near zoom 0.5; nonlethal heavy knockdown/recovery | actor 5, `knockdown` → `get-up`, LOD1 | [tick log](evidence/l1/attempt-2.json) |
| 3 | High, near zoom 0.5; lethal heavy hit from opposite side, reversed initial yaw | actor 6, `death-back`, LOD0 → LOD1 | [tick log](evidence/l1/attempt-3.json) |

| Actual rendered model | Attempt 1 | Attempt 2 | Attempt 3 |
| --- | --- | --- | --- |
| `npc.civilian-man-a` | [sheet](evidence/l1/attempt-1-npc.civilian-man-a.jpg) | [sheet](evidence/l1/attempt-2-npc.civilian-man-a.jpg) | [sheet](evidence/l1/attempt-3-npc.civilian-man-a.jpg) |
| `npc.civilian-man-b` | [sheet](evidence/l1/attempt-1-npc.civilian-man-b.jpg) | [sheet](evidence/l1/attempt-2-npc.civilian-man-b.jpg) | [sheet](evidence/l1/attempt-3-npc.civilian-man-b.jpg) |
| `npc.civilian-woman-a` | [sheet](evidence/l1/attempt-1-npc.civilian-woman-a.jpg) | [sheet](evidence/l1/attempt-2-npc.civilian-woman-a.jpg) | [sheet](evidence/l1/attempt-3-npc.civilian-woman-a.jpg) |
| `npc.civilian-woman-b` | [sheet](evidence/l1/attempt-1-npc.civilian-woman-b.jpg) | [sheet](evidence/l1/attempt-2-npc.civilian-woman-b.jpg) | [sheet](evidence/l1/attempt-3-npc.civilian-woman-b.jpg) |
| `npc.civilian-elderly` | [sheet](evidence/l1/attempt-1-npc.civilian-elderly.jpg) | [sheet](evidence/l1/attempt-2-npc.civilian-elderly.jpg) | [sheet](evidence/l1/attempt-3-npc.civilian-elderly.jpg) |

The earlier seven-native-model probe was not evidence of seven distinct drawn meshes: L1's born-infected appearance assignment can replace its named variant with a civilian model. The new receipts explicitly verify the **drawn** model against each requested campaign model at every tick. The exact original campaign actor and animation frame still cannot be recovered from its crop; reopen with that full frame/ID if it recurs.

Reproduce each bounded attempt through the shared pool: `SCENE_PORT=4347 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/q231-probes.ts l1 <1|2|3> test-results/q231-p3/l1-campaign-models-<n>`.

L10 matched palette review and final checks are in progress.
