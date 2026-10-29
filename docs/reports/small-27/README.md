# Q-191 / Q-215

Q-191 restores the clerk's ivory/coral striped rear blouse, crossed teal apron straps, waist tie/bow and denim below the waist. The reconstructed back shared fragmented UV islands; a dedicated continuous patch within its single atlas preserves the original front/sleeves/badge pixels. Body positions, weights, skeleton, outfit shape and simulation are unchanged. All three LODs and both tiers were rebuilt; the standard asset validator passes.

Inspected [low/high depot before/after](depot-comparison.jpg) from the production handover scene at game zoom 1.5 and the [supplemental back comparison](apron-back-comparison.jpg). The stripes and crossed straps read as separate cloth pieces; the front apron/badge remain teal/ivory, the waist bow sits on the body, and no fabric clips or floats. The walking clerk returns through the doorway. The depot scene retains its three pre-existing soft actor contacts (actorHitsMax=0 remains red), with zero console errors, zero body overlap and no closed-door frames. This is visual review of Q-191, not a claim that the inherited scene contact gate is green.

Q-215 exposed four controller defects. Self-defence preceded updateSurvivor, so armed followers could hold outside and shoot before receiving the Metro ingress route. A separate X-dependent sidestep destination fought the navigation grid's corner route and sent a follower back across the same threshold. Survivor formation also checked only whether a slot was clear, allowing a slot behind a wreck to pull a straggler around the wrong side. Ingress now owns the follower tick once the courier enters; navigation routes to the actual queue positions; formation uses the same two-segment visibility checks as allied followers. Finally, Metro contact yielding used movement intent rather than actual movement, so a blocked route could keep the stationary courier fixed across the stair mouth. Yielding now uses the resolved physical step; only friendly followers and the companion may push the courier, under the existing Metro condition. No L5 tuning, health, damage, population, movement speed or queue spacing changed; see [source hashes](sources.json).

Corrected isolated diagnostics rebase the recorded NPC deadlines into the fixture's tick domain and retain recorded discovery order. The standard Alpha / armed-follower case closes in **19.10 s → 3.00 s**, with the follower surviving in both versions ([before](metro-combat-before.json), [after](metro-combat-after.json)). The recorded four-person stair-mouth queue with the standing corgi closes in **8.18 s → 4.53 s**, all four sheltered ([before](metro-queue-before.json), [after](metro-queue-after.json)). A movement-only replay of the recorded courier approach improves **5.52 s → 3.40 s**, all four sheltered ([before](metro-slot-before.json), [after](metro-slot-after.json)). Baseline source: main `2c391e65f`; corrected runtime: `dca6bd2e2`.

Initial full real-input waits were 3.00 s and 6.47 s. The latter had a separate preview fetch failure during the subsequent handover and is diagnostic evidence only. The priority-only attempt still recorded 9.18 s / 7.53 s waits; the intermediate fixed-mouth waypoint recorded 5.88 s. A later direct-ingress candidate still had an 8.15 s wait caused by the earlier formation detour. Those candidates are rejected. Their raw logs and available run/issue receipts are retained under [diagnostics](diagnostics). The remaining candidate runs were cancelled when their batch failed the five-second requirement. The unused gather/far-formation experiments were reverted.

The visibility-only five-route batch recorded 4.75 / 3.17 / 9.08 / 3.77 / 6.18 s, so it was also rejected. In the 9.08 s run all five followers had movement intent but stopped for more than three seconds at the stationary courier; they moved as soon as she moved away. These logs are retained as `l5-visibility-*` under diagnostics.

## Final five real-input routes

Runtime `e70692729`: [receipts, exact ticks, hashes and counts](l5-five-runs.json), [inspected five-run capture sheet](metro-five-runs.jpg), [raw logs and completion snapshots](routes).

| Run | Arrival → shutter | Living followers boarded | Result |
| --- | --- | --- | --- |
| 1 | 3.00 s | 2 | ≤5 s |
| 2 | 6.50 s | 4 | **fails ≤5 s** |
| 3 | 3.78 s | 4 | ≤5 s |
| 4 | 4.13 s | 4 | ≤5 s |
| 5 | 3.43 s | 5 | ≤5 s |

All five finished the L6 handover, with zero issues, skips or courier deaths. Run 2 recorded one physical-input navigation recovery earlier in the level; the other runs recorded zero. All used WebGL2 low / game zoom 1.5. The scripted driver sends physical keyboard/mouse input; the observer only reads world state and captures images.

**The strict acceptance is 4/5, so Q-215 is not complete.** In run 2 Sam was 20.45 m from the courier in the first arrival snapshot and kept moving throughout ingress. At that snapshot (0.733 s after arrival), even ignoring X travel, corners, contacts and acceleration, his remaining Z travel at the frozen 3.8 m/s speed gives an earliest boarding time of 5.482 s. The actual shutter closes at 6.50 s. See the [travel bound](metro-run-2-travel.json) and raw run-2 log. This is continuous approach rather than the original blocked follow state. The five-second limit cannot be met from that observed arrival state by an ingress path correction alone.

A PO decision is needed on whether normal travel from a distant follower is covered by the five-second limit, or whether an explicitly escorted approach is an acceptable real-input acceptance run. No tuning was changed and no exception is assumed.

## Checks

Typecheck, lint and `npm test` pass (104 tests / 24 files; unchanged case budget 144/150). The final scene gate passes **48/48**, zero known and zero not run. Final smoke passes all six QA tests and the public-build test in 129.9 s (240 s budget). [Check logs and gate receipts](checks).

No new test cases or deployment.
