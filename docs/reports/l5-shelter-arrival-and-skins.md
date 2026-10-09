# L5 shelter arrival and skins · lane report

Delivered `int.metro-station` and `util.flashlight`. The four requested aftermath character compatibility IDs are **blocked**, not delivered or registered as integrated. No budget was widened and no CharacterView, NPC animation, rig, mission or level placement code was changed.

Build commit: `8c95d318`; final flashlight seam correction: `6ad465be`; stair collision completion: `4b75ddb9`. QA/tooling/report commit is listed in the final delivery message.

## Production exports

All figures below count every material primitive, including moving assemblies and emissive meshes. GLBs are losslessly packed with meshopt; source tiers are explicit solid recipes, without decimation.

| Asset | Tier | Triangles | Materials | Draws | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| int.metro-station | LOD0 | 10,480 | 5 | 8 | 184,076 |
| int.metro-station | LOD1 | 3,762 | 5 | 8 | 67,056 |
| int.metro-station | LOD2 | 2,752 | 5 | 8 | 55,092 |
| util.flashlight | LOD0 | 944 | 4 | 4 | 15,424 |
| util.flashlight | LOD1 | 276 | 4 | 4 | 8,384 |
| util.flashlight | LOD2 | 168 | 4 | 4 | 7,212 |

The station has a 30 × 20 m hall, 60 × 10 m platform, kiosk, ticket machines, seven turnstiles, benches, platform edge, rails, stair and sealed shutter. Eight main strip anchors use `metro-main`; emergency sockets reserve separately placed `prop.emergency-light` fixtures on `metro-emergency`. `shelterCampSocket` reserves separate dressing, with its own warm power group. The arrival stair also has explicit per-tread fixed collider proxies. Two maintenance doors retain distinct hinge owners, collider children and brace sockets. `roof` owns removable overhead beams; the interior has a permanent near-wall cutaway. See `assets/int.metro-station/notes.md` for all routing and dressing interfaces.

The flashlight exports rear hand/weapon sockets, +X light direction, bright lens, dark grip, red bezel/tail and `ss_light` metadata. Beam rendering and mounting/visibility remain runtime work. See `assets/util.flashlight/notes.md`.

## Visual self-review

All six game/reference/peer sheets and all six five-angle LOD contacts were inspected. The delivered station reads as a metro through the long yellow platform edge, paired rails, repeated pillars, ticket barrier row, kiosk, benches and broad stair. The full 60 m platform is broader and more sparsely furnished than the compact reference; at 135 px the individual turnstiles are small and sign lettering is unreadable. The shipped fire-station peer has stronger enclosing walls and larger local color regions because it is a much smaller room. The station local Scene Lab capture confirms the kiosk, ticket machines, individual three-spoke turnstiles, stair and both maintenance entries rather than relying solely on the distant whole-module image. LOD1/2 keep all of those silhouettes; trim, fine text and sleeper/tread density fall away explicitly.

The flashlight reads clearly at 135 and 190 px: dark grip, red tail/bezel and bright forward lens survive every tier. The far head is visibly octagonal and grip bands disappear. A close Scene Lab view exposed a coplanar cylindrical overlap at the head/bezel seam; the head radius was reduced by 3 mm, preserving the overall bounds and removing that flickering surface. It is less tapered than the reference's flared head but retains its short chunky proportions and obvious lamp direction. The Halligan peer is a shared-pipeline hand prop comparison, not a flashlight style twin. No textured label or simulated beam was added.

The character audit sheets expose defects in the existing generated far tiers: Okafor's hat/hair and sweater silhouette become ragged; Rosa's shoulder/uniform/backpack contours have jagged cuts; Mia's jacket and face lose continuity; the group has angular face/clothing patches and still exports four members together. Living faces, clothing colors and hair are recognizable in LOD0/1, but none has the requested soot/wrap treatment. Rosa still holds her medical case. These are baseline findings, not accepted skin outputs, and strengthen the need for authored replacement tiers after resolving the rig cap.

## Character blocker

The existing integrated bases are rigid meshes owned by fifteen independently moving joints per person: hip, torso, head, paired upper/lower arms, hands, thighs, shins and feet. A material merge must stay within those owners to preserve animation. Even vertex-palette batching to a single material per owner therefore needs **at least 15 draws per adult**, before separately attached gear. The survivor group has four individually named rigs (at least 60 draws); exporting two independently usable Dale/Sam members would still need at least 15 each. Static joining across owners would freeze the limbs or move parts with the wrong pivot.

The existing courier skin pipeline uses voxel remeshing/decimation and a different skinned rig; applying it here would be a rig conversion and would violate this lane's authored-LOD requirement. The GPU crowd bake is a runtime-specific `partIndex` representation, not a directly loadable alias GLB with the original rigid ownership. The contract explicitly calls for reporting this blocker rather than silently changing the rig/runtime or allowing extra draws. No duplicate base meshes or falsely healthy skin aliases were commissioned.

Measured **existing base** exports, not candidate aftermath deliveries:

| Requested compatibility ID | Base tier | Triangles | Materials | Draws | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| npc.civilian-elderly.aftermath | LOD0 | 58,742 | 25 | 56 | 304,612 |
| npc.civilian-elderly.aftermath | LOD1 | 7,538 | 25 | 56 | 67,392 |
| npc.civilian-elderly.aftermath | LOD2 | 4,000 | 25 | 56 | 50,220 |
| npc.paramedic.aftermath | LOD0 | 58,098 | 23 | 80 | 309,048 |
| npc.paramedic.aftermath | LOD1 | 7,494 | 23 | 80 | 71,316 |
| npc.paramedic.aftermath | LOD2 | 4,644 | 23 | 80 | 57,328 |
| npc.civilian-woman-a.aftermath | LOD0 | 56,934 | 13 | 35 | 285,352 |
| npc.civilian-woman-a.aftermath | LOD1 | 5,588 | 13 | 35 | 134,804 |
| npc.civilian-woman-a.aftermath | LOD2 | 1,678 | 13 | 35 | 54,848 |
| npc.survivor-group.aftermath | LOD0 | 56,324 | 31 | 218 | 393,832 |
| npc.survivor-group.aftermath | LOD1 | 13,616 | 31 | 218 | 175,136 |
| npc.survivor-group.aftermath | LOD2 | 11,258 | 31 | 218 | 164,028 |

Required follow-up: agree a named-NPC rig/crowd delivery contract that supports ≤8 draws while retaining the accepted identities, then author soot, clean pale bandages, empty hands and explicit distance tiers. Rosa's existing medical case must be removed; Dale and Sam must be separate usable members, not a whole group alias. Current generated base LODs are inspection evidence only and are not claimed as new authored tiers.

## Validation and evidence

Per canonical asset, sequentially:

```sh
npm run assets:build -- int.metro-station
npm run assets:pack -- int.metro-station
npm run assets:validate -- --ids int.metro-station
npm run assets:build -- util.flashlight
npm run assets:pack -- util.flashlight
npm run assets:validate -- --ids util.flashlight
npm run assets:lights
npx tsx tools/assets/physics-metadata.ts
npm run assets:collision
npm run build
npm run preview -- --port 3353
E2E_PORT=3353 E2E_SLOTS=2 E2E_WAIT=1 sh tools/e2e-lock.sh npm run assets:turntable -- int.metro-station,util.flashlight --lod-contact --output test-results/l5-shelter-arrival-and-skins
E2E_PORT=3353 E2E_SLOTS=2 E2E_WAIT=1 sh tools/e2e-lock.sh npx tsx assets/int.metro-station/qa-capture.ts
python3 assets/int.metro-station/qa-sheets.py
SCENE_PORT=3353 SCENE_SERVER=preview E2E_SLOTS=2 E2E_WAIT=1 npm run scene -- assets/int.metro-station/qa-scene.json assets/util.flashlight/qa-scene.json --backend webgl2 --size 1280x720 --out test-results/l5-shelter-arrival-and-skins/scene-lab
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh . -- npm run test:unit -- --maxWorkers=4
```

Asset-specific validation: 3/3 tiers for each delivered asset, zero errors. Global validation: 952 checks, zero failures. Typecheck and lint passed. Production build passed. Light table: 347 anchors in 91 assets, zero errors or unreferenced emissive meshes. Collision and physics metadata regeneration passed. Repeated Blender builds produced identical source geometry hashes: station `079c70373cf6c3e471adfcb220ae4a58cd80c524ecd1a92d38b5d322d8ca972e`; flashlight `a09e966d2e5e1bb8cf30de747af839072b286b98253bfef66bfaa629904f3e2e`. Remote unit suite passed on the final flashlight exports: 108 files / 384 tests / zero failures. After the collider-only stair addition, `npx vitest run tests/unit/physics-metadata.test.ts --maxWorkers=4` also passed (1 file / 1 test). Scene Lab passed both asset scenes (two assertions each: zero console errors and zero undrawn frames). The final screenshots were inspected after the camera adjustment described below.

Evidence directory: `test-results/l5-shelter-arrival-and-skins/<requested-id>/`. Each of the six rows receives `game-reference-peer.jpg`, `reference-lod-contact.jpg` and `loading.json`; blocked IDs are labeled **existing base audit only**, not rendered aftermath aliases. The two canonical outputs additionally have standard `lod-contact.png` / `.json` and a final `scene-lab.jpg`; Scene Lab metrics are retained in its sibling directory. Temporary capture PNGs were deleted. Sheets are at most 1600 px wide and show all tiers at 135/190 px, all-side inspections and the unchanged reference. Peer for the station is `int.fire-station-bay`; flashlight peer is `wpn.halligan`; character audits compare their original integrated base. JPG game sheets are also copied to the orchestrator's requested scratchpad `l5-assets` directory.

The initial full-station preview was uniformly fog-colored: fitting a 60 m module in a 135 px frame placed the inspector beyond its fixed 140 m fog cutoff. `src/assets/viewer.ts` now supplies the same existing palette lighting graph explicitly and offsets fog ranges by the inspection camera distance, following the game's zoom-relative fog convention. Geometry and game lighting are unchanged. The final viewer build, typecheck, lint and headless captures validate this dev-tool correction. The station Scene Lab camera is closer (55 m) and checks the hall/platform locally instead of hiding the whole station behind cinematic-distance fog.

No gameplay code changed, so `test:smoke` and level `verify E23/E24` are not applicable to this asset lane. No level implementation is claimed.

No main merge was needed at start (`git rev-list --count HEAD..main` returned 0). The requested `epics-pipeline/briefs/art-l2l3.body.md` was absent; merged `docs/reports/art-l2l3.md`, shared source patterns and the PO/E23/E24 specs were inspected. References were visually inspected before modeling. No specifications, references, folio, initial drafts or experiment files were edited. No push, merge into main or deployment. Independent orchestrator acceptance and manual WebGPU parity remain pending.
