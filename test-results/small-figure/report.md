# Small figure

The defect is an age/skin mismatch in L2's trapped crowd. `spawnTrapped` assigned adult `npc.civilian-woman-b` skins to its two protected children; `CivilianBatch` then applied a uniform 0.7 scale. The model includes the glasses, hair bun, blouse, trousers and lanyard visible in the PO screenshot. Its native standing height is 1.8 m, reduced to 1.26 m by that instance scale.

In the original L2 seed 1 reconstruction, the affected entities are 159 (`npc.delivery-driver`) and 167 (`npc.jogger`), both with `civilian.adult = false` and `appearance.asset = npc.civilian-woman-b`. Both exit from the loading door towards the reported street. The screenshot does not contain an entity id or an input recording, so it cannot establish which of those two children was photographed. The saved reconstruction reaches tick 5634 with the courier at (-50.02, -32.70), but does not replay the PO's exact movement and door-opening time. The comparison captures explicitly stage the faulty spawn combination beside the courier at that spot.

Children now spawn with `npc.child` and the authored `npc.civilian-kid` skin, at its native 1.4744 m height and with child proportions. The extra 0.7 instance/stride factors are removed. Old checkpoints with the mismatched adult skin resolve to the child model, including the close LOD selection. Child escorts use the authored `npc.brother` model at 1.4265 m rather than a scaled adult placeholder.

The height sweep also found four older adult NPC exports below the civilian roster's range: lab-tech-a (1.365 m), lab-tech-b (1.380 m), lab-guard (1.386 m) and depot-clerk (1.424 m). Standing NPC models outside 0.92–1.08 of their age's base height are fitted before baking. That keeps geometry, joints, stride and carried props in the same frame. The adult base is 1.8 m; authored child, animal, brute, crawling and corpse silhouettes retain their own bases. No asset or specification files were edited for this fix.

The regression sweep covers 74 shipped NPC/infected skins × three LODs × two quality tiers (444 geometry cases), plus civilian/ally/former-infected model routing. Heights come from the merged vertices transformed by the baked rigid-part matrices. The original child-routing test fails on `npc.civilian-woman-b`; both original browser reproductions fail the child-skin assertion. The corrected tests check sim age/skin identity, submitted instance scale and draw visibility.

## Visual review

Both low-tier game-camera comparison captures were inspected at the reported street coordinates. WebGPU and WebGL show the same child with a blue backpack, shorts, shorter legs and red sneakers; the adult glasses, bun, blouse and lanyard are gone. The child is grounded beside the courier, with no extra instance reduction (`scale = [1, 1, 1]`). The checkpoint captures and the explicitly staged comparison are saved separately. The latter is a controlled reproduction, not a claim to replay the PO's exact input sequence.

## Validation

- Final committed code: typecheck, lint and production build passed.
- Remote full unit suite plus the focused L2 sim regression: 461 passed; remote smoke: 6 passed.
- First browser batch: 36 passed, 1 failed. Both low-tier reproductions, both crowd-visible outbreak backends, L1–L4, L5 draw captures, L6 and Chromium smoke passed. The L5 real-input group-photo test lost two followers to infection in the first batch; the unchanged test passed in isolation (all five survivors handed over to L6, zero console errors).
- The final expanded 444-case height/archetype sweep and checkpoint routing checks passed all 9 tests (2026-10-11). The same remote sweep with height fitting disabled failed all six cases, first detecting `npc.lab-tech-a` at 1.365 m / 1.8 m (0.758), below the 0.92 minimum.
- `verify E08` passed typecheck/lint/build and 50 selected remote tests, but stopped on its existing high-tier L1 patrol timing budget (5.087 ms vs 4 ms). The unchanged timing test passed locally under `tools/sim-lock.sh` for all L1–L5 patrols. The complete local E08 rerun, including high/low × WebGPU/WebGL and device smoke, could not start: another lane’s stopped validation shell (PID 44077, `STAT T`) held both browser slots via lockf 8012 / parent 69009. The owning session was notified and asked whether that pause was intentional. This job’s waiting command was cancelled; that gate and the high-tier captures remain outstanding. The required low-tier WebGPU/WebGL captures were completed and inspected.

Main was merged into this lane before the final validation. No deployment or merge into main was performed.

## Delivery status

The cause is fixed and the requested low-tier reproduction, visual review, remote units/smoke, level checks (after the isolated L5 retry), and both crowd-visible backends pass. Final full E08 closure is blocked by another lane’s stopped browser-lock holder. High-tier browser regression cases are authored but not yet run. The original PO photograph cannot distinguish which of the two affected children was pictured.
