# L4 convoy clearance — PO 2026-10-14

The convoy yields to live, visible actor footprints, including cowering/seated bodies, bags, pets and the corgi. Pedestrians use the existing kerb-walk order ahead of the column. Vehicles brake for an obstruction and check their eased turning poses before advancing. Movement is constrained after steering, crowd separation and inertia, including parking/unloading. Unsafe initial placements are corrected before the first frame; the large sideways fallback is restricted to off-screen actors.

## Cause and reproduction

The old guard used the opposite yaw sign to three.js, tested actor centres, snapped actors after advancing, and stopped checking at arrival. Its old actor test repeated the yaw error and sampled only every sixth tick. Authored routines and soldier posts also led actors back beneath parked vehicles.

The new independent oracle checks every tick of drive → stop → unload plus ten seconds after arrival, against each rendered vehicle OBB expanded by 0.3 m. It uses conservative posed radii and active seat displacement. Carried, hidden passengers are excluded. Assertions confirm soldier, evacuee, corgi and pet coverage; a real pet fixture guarantees coverage in low-tier seeds that omit ambient pets. Separate high/low fixtures exercise an immobile infected, a cowering woman with a bag, and a walking dog.

| Tier | Seed | Original overlap records | Original affected ticks | Fixed overlaps |
| --- | --- | ---: | ---: | ---: |
| high | 1 | 6,092 | 1,718 | 0 |
| high | 2 | 6,574 | 1,571 | 0 |
| high | 3 | 5,635 | 1,170 | 0 |
| low | 1 | 2,744 | 1,053 | 0 |
| low | 2 | 2,826 | 1,080 | 0 |
| low | 3 | 2,767 | 1,185 | 0 |

Records are in `test-results/l4-bus-clear/overlaps-<tier>-<seed>.json`, with the original failures in `baseline/`. Arrival is 30.48 s, within the unchanged 20–35 s requirement. The infected obstruction stops the convoy; clearing it resumes travel. The woman/dog fixture walks clear with maximum movement below 0.15 m per tick.

## Vehicles, props and reachable goals

The exact six-wheel-truck/orange-box screenshot was not reproduced at the current convoy or authored military-truck poses. The inspection did find a scripted fuel truck intersecting several storefront solids at (8, -9.5). It now parks at (16.3, -9.5); its actual 11.265 × 3.1601 m hull clears solids and passing vehicles. Initial actors are cleared before rendering while preserving population RNG and entity creation order. The fuel anchor and checkpoint blocker agree with its new position.

The first closing rail formerly left only 1.5 cm behind the bus. It moves 0.5 m farther south. The APC stop ends 15 cm earlier to clear the frontage steps. The independent SAT test covers final convoy hulls, placed military vehicles, the scripted fuel truck and closing rails with a 0.3 m buffer. The existing general placement gate now includes all L4 vehicles, without changing its backlog baseline.

Parked navigation includes posed-body clearance, and normal routines are redirected to reachable goals. Unsafe guard posts and an off-duty chat move clear. The final fallback crew holds farther west, with checkpoints behind it in bumper gaps and at the southern corner. The escape passage/checkpoint use z=16, below the closed rails and parked trucks. This preserves the unchanged bot limits: complete seed 3 finishes in 321.82 s with two deaths; newbie seed 4 finishes in 352.52 s with one. The untouched starting commit also passed both bot tests. No bot policy, damage, accuracy, population cap or acceptance threshold was changed.

The wider blast wreck rotates and settles 0.8 m west of the truck, shared by L4 and its devastated L5 twin. It clears the frontage and preserves the existing less-than-1-m continuity assertion. L5 uses the existing placement helper.

Two fixtures now use physically valid positions: the exit test starts on the authored clear passage; the safe-post fixture threatens two separated posts on clear ground. The lost-soldier assertion recognizes completed infection only for infected faction without an ally component. Its no-resurrection requirement remains.

## Verification

Typecheck, lint and a fresh production build pass. Heavy tests ran on Hetzner, capped at four workers.

- Ten actor tests, four existing convoy tests, vehicle-versus-solids and general placement gates pass.
- Final focused L4 suite: 29/29 pass (PO, collapse, respawn, convoy and actor audit); both complete/newbie bot assertions pass separately.
- Full unit sweep: 1,401 passed, seven skipped, one unchanged 300-second asset-validation timeout. Isolated rerun of that file: all 17 passed.
- Full sim sweep: 984 passed; five timing assertions failed. Three resolved in isolation. Mega audio (4.31 ms versus 4 ms) and zoo S2 (5.64 ms versus 4 ms) remain red on runner 2.28.24.66; a final retry on 94.130.181.173 is queued. These failures do not exercise the L4 controller. The full sim sweep is not claimed green.
- A full levels sweep ran on intermediate code; it was not wholly green. Final L4 regressions above supersede its L4 failures. No claim is made that the complete levels sweep is green.
- All 17 native-GPU browser ride configurations passed earlier in this job. Final-source rerun could not acquire all browser slots immediately and remains unmeasured.

## Game-camera review

Five catalog scenes cover production drive/cower, gate stop, truck stop, fuel stop and L5 crater continuity. Both actual WebGL2 and WebGPU ran high/low at zoom 0.5/1/1.5, 960×540: **60/60 combinations pass**. The four convoy scenes gate zero overlap frames. Initial reload-interrupted cases were rerun; final matrices passed 24/24 per backend. Browser runs were headless, used unique ports, and released reservations between batches. Quiet reservations never exceeded 20 minutes; further long waits were avoided after reaching the slot-wait cap.

Opened sheets show the woman staying behind the kerb rail while the trucks and white EVAC bus pass; the other woman walks clear ahead of the bus. Close zoom shows wheel/body separation; wide zoom shows the column. Truck wheels and bumper rest over bare plaza tiles, with no orange block underneath. Low tier uses simpler canvas/wheels while keeping the rail gap. The crater scene uses the ordinary courier roof cutout: after its fade, the wreck lies in the road, separated from the frontage. The supplemental intact-fuel scene remains obscured by the eastern roof/chimney; it cannot visually establish that hull's clearance. The independent static check establishes it.

Committed review sheets: [cower high](l4-bus-clear/cower-webgl2-high-z1.jpg), [cower low](l4-bus-clear/cower-webgpu-low-z0.5.jpg), [gate high](l4-bus-clear/gate-webgl2-high-z1.jpg), [gate low](l4-bus-clear/gate-webgpu-low-z0.5.jpg), [truck high](l4-bus-clear/truck-webgl2-high-z1.jpg), [truck low](l4-bus-clear/truck-webgpu-low-z1.jpg), [crater high](l4-bus-clear/crater-webgl2-high-z1.jpg), [crater low](l4-bus-clear/crater-webgpu-low-z0.5.jpg). Full local matrices: `test-results/l4-bus-clear/verified-{webgl2,webgpu}` and `crater-{webgl2,webgpu}`.

## E18 performance

Final high and low tests both pass, including surviving/firing soldiers. Native desktop high; phone low at 4× CPU throttle. [Committed measurement summary](l4-bus-clear/performance.json).

| Metric | High | Low |
| --- | ---: | ---: |
| Sim p95, ms | 3.10 | 5.90 |
| War/collapse frame p95, ms | 11.0 / 10.1 | 32.9 / 30.9 |
| War/collapse frame p50, ms | 9.0 / 6.9 | 23.5 / 23.8 |
| War/collapse draws | 331 / 302 | 183 / 218 |
| War/collapse triangles | 1,208,057 / 1,371,534 | 330,830 / 375,096 |
| Turn/tank/break maximum, ms | 18.8 / 18.1 / 13.4 | 64.1 / 34.1 / 43.6 |
