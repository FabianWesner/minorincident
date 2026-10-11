# L3 route integration review

Reviewed the regenerated PNGs directly, including the four blockade views, entry/exit ramps and gantry, four tower decks, game camera views, the live Commerce compound-rest frame, and tower firing frames 7/30. Captures use headless Chromium, ANGLE/Metal, seed 1 and the production build; the fixed overview views use Scene Lab inspection.

| Check | Result and evidence |
| --- | --- |
| Four sealed streets | PASS: Commerce west/east and Boulevard/Oak wreck piles visibly span the carriageway into both pavements. Burned bus shells and compacted cars read as physical obstacles, with recognizable diner, bakery and residential frontage around them. The route test also checks both NPC clearances and physically walks the courier into each blockade. |
| Highway approach | PASS: the S-shaped entry rises onto the bridge, the wrecked blue sedan occupies part of the elevated span, and the exit descends to the checkpoint gate. The SUNSET GROVE EXIT gantry is legible above the curve; concrete rails, lamps and the outside fence make the connection readable. |
| Compound and guards | PASS: all four translated towers carry two riflemen with feet resting on the wooden decks. Bodies are above and beside the perimeter walls, with no soldier embedded in the wall panels. Sandbag nests, razor wire, lamps, vehicles and buses preserve the stronger army setting. |
| Shots respect walls | PASS: LOD0/1/2 firing sequences each record 21 shots; reviewed tracers pass above the perimeter wall to exterior infected. Ground, cached-target and taller-building occlusion cases pass in the five shot-cover tests. The shots are intentionally elevated; those tests still prevent shots through taller cover. |
| Ground footprints and finale | PASS: in `compound-rest-commerce.png`, the courier's footprints curve through the open gate and lie on the compound ground. They do not run through a wall. The yellow rendezvous ring lies on the ground deeper inside, with the courier resting 5 m away and the objective still active. |
| A: palette, camera, shadows | PASS: warm buildings and foliage retain the saturated toy-like look, pale-purple shadows and glowing lamps. Overview and game-scale frames keep the high three-quarter camera; tower helmets, rifles and boots remain readable. |
| D: gameplay readability | PASS in the live rest frame and firing proof: the courier, HUD, pickup/goal cues and red-eyed exterior infected remain distinct from the ground and perimeter. Muzzle flashes and tracers are brief and do not obscure the guards. |
| E/G: decay and lighting | PASS for the changed locations: bus shells, damaged cars, boarded storefronts and bodies read as recent collapse within the existing city. Elevated street lamps are mounted on the road deck; the night views retain visible road surfaces and colored light pools. |

The complete simulation brings all ten recruited officers through with no casualties, as the current fallback recruitment allows. Its longest walk without a living infected within 18 m is 88.2 m, versus 28.4 m in the earlier route lane. This is a pacing observation, not proof of the older squad-attrition acceptance criteria. The planned encounter-anchor gap remains 53.5 m and the walking route remains 480.6 m.

The inherited route lane corrects E21 AC11's obsolete straight-line distance and expands AC02's upper time band for the PO's 2026-10-11 longer route. No additional specification correction was made during this integration.

## Loading evidence

`load-summary.json` compares untouched main `83969f51` with the final production build: headless Chromium on native Apple WebGPU, high tier, fresh browser profiles, a local HTTP/2 TLS server applying the project's Pages headers and Brotli compression, and CDP throttling at 50 Mbit/s / 20 ms.

| Version | Cold card / first playable | Warm card / first playable |
| --- | --- | --- |
| Main | 8.78 / 8.83 s | 4.12 / 4.12 s |
| Final route | 5.35 / 5.59 s | 2.88 / 3.28 s |

Both runs used native WebGPU, recorded no console errors, had idle frame p95 16.7–16.8 ms, and recorded no frames above 50 ms. Machine load was substantial and is retained with each measurement; these absolute times come from the local HTTP/2 setup. Earlier `baseline`/`candidate` and `*-repeat` JSONs record the measurements before the train registration, including a noisy repeat where the candidate was slower.

The concrete startup issue was `veh.train-freight` lacking world metadata, which sent the new distant dressing through the full-detail non-world path. Registering its existing world/LOD policy changes its cold transfer from 1,381,693 bytes of LOD0 to 34,190 bytes of authored LOD2; the final request log contains no train LOD0 fetch. Its normal close-distance upgrades remain available. Static bakes were regenerated with `npm run assets:bake-statics`, retaining 140 entries and the existing bake size-limit policy.

## Validation limits

`npm run verify -- E21` completed its simulation stage with 67 passes and eight failures, then stopped before the later epic stages. The failures are T-E21-05, 07, 08, 10, 12, 13 and 14, plus the rescued-station-straggler retreat case. All eight names also fail in main's recorded [l3-textures validation](../l3-textures-data/validation.txt); no additional failing test ID appears in this run. This comparison establishes the existing failure names, not equivalence of every underlying gameplay metric. The 88.2 m quiet walk above remains a pacing limitation.

Final typecheck, lint, build and all 789 unit tests pass. The focused route/finale/static/shot-cover suite passes 26/26; final Chromium L3 passes 4/4. Final smoke passes 6/6 simulation checks and initially 24/26 browser checks: the existing T-E13-05 save/continue rack mismatch and a 100 ms audio timeout under machine load. The unchanged audio smoke passes on isolated retry, leaving the known save mismatch unresolved. Logs and JSONs are retained beside this review.
