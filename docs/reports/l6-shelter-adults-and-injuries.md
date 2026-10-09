# L6 shelter adults and injuries

Seven adult assets derived from the integrated civilian sculpt recipes and rigid hierarchies on main `930b24a0`. Native construction recipes author all three tiers; no generic decimation. Warm healthy skin, broad dusty clothing, pale wraps, preserved named limbs and weapon sockets. Sitting/lying remain movable hierarchies. No gameplay, crowd behavior or CharacterView changes.

The revised living-adult draw contract is enforced by `animatedDrawBase`: total owner/material draws, including static attachments, are checked against the shipped base at the same LOD. Repeated primitives of the same material under one owner are rejected as unbatched. The base budgets are unchanged. Materials are limited to eight on every delivered tier.

| Asset | LOD | Triangles | Draws | Materials | Production bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| npc.civilian-man-a.aftermath | lod0 | 14260 | 34 | 8 | 181604 |
| npc.civilian-man-a.aftermath | lod1 | 5653 | 29 | 8 | 90800 |
| npc.civilian-man-a.aftermath | lod2 | 1943 | 28 | 8 | 44072 |
| npc.civilian-man-b.aftermath | lod0 | 11438 | 31 | 8 | 174892 |
| npc.civilian-man-b.aftermath | lod1 | 5989 | 31 | 8 | 91440 |
| npc.civilian-man-b.aftermath | lod2 | 1913 | 28 | 8 | 41568 |
| npc.civilian-woman-b.aftermath | lod0 | 10068 | 36 | 8 | 125540 |
| npc.civilian-woman-b.aftermath | lod1 | 5932 | 31 | 8 | 88428 |
| npc.civilian-woman-b.aftermath | lod2 | 1992 | 28 | 8 | 45660 |
| npc.marcus.aftermath | lod0 | 14296 | 34 | 8 | 181892 |
| npc.marcus.aftermath | lod1 | 5677 | 30 | 8 | 90880 |
| npc.marcus.aftermath | lod2 | 1959 | 29 | 8 | 44348 |
| npc.shelter-survivor.bandaged | lod0 | 14332 | 35 | 8 | 182240 |
| npc.shelter-survivor.bandaged | lod1 | 5701 | 30 | 8 | 91144 |
| npc.shelter-survivor.bandaged | lod2 | 1975 | 29 | 8 | 44616 |
| npc.shelter-survivor.lying | lod0 | 14272 | 35 | 8 | 183464 |
| npc.shelter-survivor.lying | lod1 | 5665 | 30 | 8 | 92152 |
| npc.shelter-survivor.lying | lod2 | 1955 | 29 | 8 | 45200 |
| npc.shelter-survivor.sitting | lod0 | 14296 | 34 | 8 | 182364 |
| npc.shelter-survivor.sitting | lod1 | 5677 | 29 | 8 | 91764 |
| npc.shelter-survivor.sitting | lod2 | 1959 | 28 | 8 | 44824 |

Validation: `npm run assets:validate` passed **967/967** checks; `npm run typecheck` and `npm run lint` passed. Full unit suite: **393/393 tests, 110/110 files** (remote runner; four workers). Initial unit run failed three standing-only height/gait assumptions; tests now restore the delivered standing frame before testing height and locomotion, retaining the original numeric limits. All 31 affected tests then passed, followed by the green full suite.

Commands, sequential per canonical ID:

```sh
npm run assets:build -- <id>
npm run assets:pack -- <id>
npm run assets:validate -- --ids <id>
E2E_PORT=3314 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --output test-results/l6-shelter-adults-and-injuries
E2E_PORT=3314 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --lod-contact --output test-results/l6-shelter-adults-and-injuries
```

Final checks:

```sh
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh "$PWD" -- npm run test:unit -- --maxWorkers=4
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit/assets/living-adults.test.ts tests/unit/assets/optimize.test.ts tests/unit/render/authored-animation.test.ts --maxWorkers=2
E2E_PORT=3314 sh tools/e2e-lock.sh npx tsx tools/assets/living-adult-qa.ts
SCENE_PORT=3314 SCENE_SERVER=preview sh tools/e2e-lock.sh npm run scene -- tools/assets/fixtures/l6-shelter-adults.scene.json --backend webgl2 --size 1440x900 --out test-results/l6-shelter-adults-and-injuries/scene-lab
```

Interface: each root exports JSON `ss_standingPose` containing glTF Y-up local translation/quaternion/scale per original joint. Restore those values before sampling retreat clips. Hide/remove `restOnlyNodes` on standing transition (lying: `restCushion`). Reset tests compare standing joint positions to the shipped base at every tier; the existing gait tests exercise grounded walking/running after reset. Marcus's empty `weaponSocketR` remains available for the handgun. Routine selection, animation transitions, crowd registration, district placement and weapon assignment remain runtime-lane work.

Deviations: L5 aftermath skins were not merged on main; the batch uses the shipped civilian bases and adopts the in-progress L5 native recipe / zero-width bevel conventions. The requested art-l2l3 brief was absent in this checkout and was read at its main-workspace path. Marcus shares Man A anatomy/hair and uses a teal/olive outfit with a yellow organizer band; the supplied reference has a darker shirt. Rest-pose dimensions are measured pose bounds, not standing height. No children, new dependencies, atlases, reference edits or spec edits.

Visual evidence: `test-results/l6-shelter-adults-and-injuries/<id>/comparison.png`, `lod-contact.png`, `game-reference-peer.png` and `review.md` for all seven IDs. Each peer sheet includes reference | own LOD0/1/2 | shipped peer LOD0/1/2 at 135 and 190 px. All sheets were inspected; no placeholders or browser console errors. Standard turntable occupancy passes 10–80% for every angle. JPG copies of all peer sheets are in the requested orchestrator scratchpad `l5-assets/`.

Visual limitations: LOD2 noticeably simplifies hair, shoe trim and hands; clothing/rig/rest silhouettes and wraps remain. Woman B’s far forearm wrap is less exposed at the fixed camera. Marcus uses the younger Man A face rather than the older reference face. The bandaged survivor has shoulder/forearm dressings instead of a chest sling. Sitting is a low mat pose, not bench height. Lying has open healthy eyes and a rectangular cushion; its early raised hand was corrected and recaptured. Full per-asset comparisons are in sibling `review.md` files. Independent orchestrator visual acceptance remains pending.

Scene Lab: seven-model fixed-camera arrangement passed 60 frames, console errors 0, clipping 0. No runtime gameplay was implemented, so smoke/level-epic verification was not applicable to this asset lane. No blocking issues remain.

Commits: `8e846a22` (draw validator and QA helper), `353ac530` (seven adult deliveries and pose-reset tests), `12dedd2c` (reclined resting arm correction). No push, merge to main or deployment.
