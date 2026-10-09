# L5 shelter arrival and skins — delivery report

All six requested IDs are delivered and registered as integrated. The station, flashlight and stair collision were preserved from `lane/build-l5-shelter-arrival-and-skins-part1` (8c95d318 through 4653b111), merged as `24d74142`. Main was then merged as `c9eb420c`, preserving both sides. The former character blocker is resolved by the orchestrator’s revised living-adult draw contract; validator commit `59d90231` implements it. Asset/source/manifest delivery commit: `8f5a1079`. The final evidence commit is recorded in the delivery message and lane history.

## Source and integration contracts

Four aftermath stocks derive from the original shipped build sources and their existing fifteen-owner rigid rigs. `tools/blender/sslib/aftermath.py` adapts native primitive recipes before the old finishing/decimation steps: explicit radial/ring/curve counts, named trim omissions, closed far hair volume and planar flower petals. No remesh or decimation is executed. Static attachments, wraps and vertex palette colors batch into their native animation owner using `export.merge_by_material`. Characters use one palette material, 15 draws per adult; the four-member group uses 60. Actual shipped-base counts are 56 (elderly), 80 (paramedic), 35 (woman), and 218 (group) per tier. `rigidDrawBase` makes validation inspect the shipped base at the same LOD, count animated-owner draws and reject duplicate owner/material primitives. No global draw limit was loosened.

The complete group satisfies the 15k/6k/2k planning caps itself. Separately usable IDs `.dale`, `.sam`, `.cap-woman`, `.bun-woman` extract its shared authored GLBs, reset member placement/yaw and restore ordinary unprefixed rig node names. Build the group first. They preserve the native adult physics/animation contract and have individual mounting/hand anchors; no NPC prop physics was invented. Okafor, Rosa and Mia stocks preserve base pivots and scale. Rosa has empty hands. Runtime named casts can reuse these stock outputs when identity matches; a concurrent named-cast lane was notified to reconcile aliases rather than duplicate meshes. This lane does not register speculative aliases to different-looking characters or implement cast behavior.

Every canonical ID has `assets/<id>/build.py`, source model/LOD files and corresponding packed production tiers. Stock scripts honor `--glb` and `--distance-tier 0/1/2`; the member wrappers depend on the group’s explicit three authored files. Manifest dimensions are measured after the base sourceScale is applied once. Required/animated nodes, sockets and +X front anchors survive every tier. Palette colors come from the shared palette; no new textures or dependencies were introduced.

The station has a 30 × 20 m hall, 60 × 10 m platform, kiosk, ticket machines, seven turnstiles, benches, platform edge, rails, stair and sealed shutter. Eight main strip anchors use `metro-main`; emergency sockets reserve separately placed `prop.emergency-light` fixtures on `metro-emergency`. `shelterCampSocket` reserves separate dressing, with its own warm power group. The arrival stair also has explicit per-tread fixed collider proxies. Two maintenance doors retain distinct hinge owners, collider children and brace sockets. `roof` owns removable overhead beams; the interior has a permanent near-wall cutaway. See `assets/int.metro-station/notes.md` for all routing and dressing interfaces.

The flashlight exports rear hand/weapon sockets, +X light direction, bright lens, dark grip, red bezel/tail and `ss_light` metadata. Beam rendering and mounting/visibility remain runtime work. See `assets/util.flashlight/notes.md`.


## Production measurements

Packed production bytes; every primitive, animated owner and emissive mesh counts toward draws. Materials are 5 for the station, 4 for the flashlight, and 1 for every character tier. All 30 tier measurements have zero validation errors. Viewer loading records include the inspector floor (one extra draw/triangle); the table counts GLB geometry only. Full measured dimensions and hashes are retained in `test-results/l5-shelter-arrival-and-skins/metrics.json`.

| Asset | Tier | Triangles | Materials | Draws | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| util.flashlight | LOD0 | 944 | 4 | 4 | 15,424 |
| util.flashlight | LOD1 | 276 | 4 | 4 | 8,384 |
| util.flashlight | LOD2 | 168 | 4 | 4 | 7,212 |
| int.metro-station | LOD0 | 10,480 | 5 | 8 | 184,076 |
| int.metro-station | LOD1 | 3,762 | 5 | 8 | 67,056 |
| int.metro-station | LOD2 | 2,752 | 5 | 8 | 55,092 |
| npc.civilian-elderly.aftermath | LOD0 | 10,916 | 1 | 15 | 72,192 |
| npc.civilian-elderly.aftermath | LOD1 | 5,216 | 1 | 15 | 44,676 |
| npc.civilian-elderly.aftermath | LOD2 | 1,192 | 1 | 15 | 22,812 |
| npc.paramedic.aftermath | LOD0 | 14,364 | 1 | 15 | 91,536 |
| npc.paramedic.aftermath | LOD1 | 5,512 | 1 | 15 | 46,528 |
| npc.paramedic.aftermath | LOD2 | 1,882 | 1 | 15 | 26,876 |
| npc.civilian-woman-a.aftermath | LOD0 | 11,055 | 1 | 15 | 75,740 |
| npc.civilian-woman-a.aftermath | LOD1 | 5,663 | 1 | 15 | 48,872 |
| npc.civilian-woman-a.aftermath | LOD2 | 1,703 | 1 | 15 | 25,900 |
| npc.survivor-group.aftermath | LOD0 | 13,232 | 1 | 60 | 131,036 |
| npc.survivor-group.aftermath | LOD1 | 4,828 | 1 | 60 | 79,564 |
| npc.survivor-group.aftermath | LOD2 | 1,948 | 1 | 60 | 60,632 |
| npc.survivor-group.aftermath.dale | LOD0 | 3,476 | 1 | 15 | 34,736 |
| npc.survivor-group.aftermath.dale | LOD1 | 1,158 | 1 | 15 | 21,772 |
| npc.survivor-group.aftermath.dale | LOD2 | 506 | 1 | 15 | 18,008 |
| npc.survivor-group.aftermath.sam | LOD0 | 3,600 | 1 | 15 | 35,524 |
| npc.survivor-group.aftermath.sam | LOD1 | 1,682 | 1 | 15 | 24,416 |
| npc.survivor-group.aftermath.sam | LOD2 | 634 | 1 | 15 | 18,520 |
| npc.survivor-group.aftermath.cap-woman | LOD0 | 2,968 | 1 | 15 | 32,360 |
| npc.survivor-group.aftermath.cap-woman | LOD1 | 910 | 1 | 15 | 20,352 |
| npc.survivor-group.aftermath.cap-woman | LOD2 | 426 | 1 | 15 | 17,512 |
| npc.survivor-group.aftermath.bun-woman | LOD0 | 3,188 | 1 | 15 | 33,536 |
| npc.survivor-group.aftermath.bun-woman | LOD1 | 1,078 | 1 | 15 | 21,116 |
| npc.survivor-group.aftermath.bun-woman | LOD2 | 382 | 1 | 15 | 17,276 |

## Visual self-review

Final game-reference-peer sheets and five-angle authored LOD contact sheets were inspected for all ten outputs. Every stock sheet compares actual delivered LOD0/1/2 with the supplied reference and the shipped original peer at 135 and 190 px. Separate members compare their inherited group reference and shipped group peer; these images clearly label the separately loaded member. All loading records report actual outputs with no placeholder.

**npc.civilian-elderly.aftermath:** Cane, cap, white hair, glasses and burgundy argyle retain the elderly identity. Broad feathered clothing grime and a pale left arm wrap are attached to the existing native owners. The base peer is richer in plaid and curls; far hair, face and cap are visibly angular. The wrap reads at 190 px; soot is subtle at 135 px.

**npc.paramedic.aftermath:** Healthy face, auburn ponytail, uniform, medical backpack and yellow trouser bands remain recognizable. Both hands are empty; the base peer still carries its medical case. Pale cuff and clothing grime are present, though the grime is subtle at 135 px. The far ponytail is a closed authored volume, visibly faceted; small collar trim and rounded eyes simplify.

**npc.civilian-woman-a.aftermath:** Living face, red floral dress, pale cardigan, bun, tote and red shoes remain. Dust on the hem and broad cardigan soot are feathered vertex fields; the pale arm cuff follows the forearm. The far tier drops the tote botanical motif and small flowers. Face, bun and cardigan become angular compared with the richer shipped peer.

**npc.survivor-group.aftermath:** Four distinguishable adults retain caps, beard, glasses, bun, clothing colors and backpacks. Each has its own wrap and grime. Far tiers remove pockets, straps and tailoring; the original peer is much richer in close details. Group height remains 1.777–1.800 m per adult across tiers. Four separately registered member GLBs load correctly, retaining fifteen native animation owners each.

**Station:** long yellow edge, paired rails, pillars, ticket barrier row, kiosk, benches and broad stair give the metro read. At whole-module 135 px, the required 60 m platform makes furnishings small, floor areas sparse and sign text unreadable. The compact shipped fire-station peer has stronger enclosing walls and local detail. The final local Scene Lab view resolves turnstiles, ticket machines, kiosk, stair and both maintenance entries. LOD1/2 preserve their silhouettes while reducing trim and sleeper/tread density.

**Flashlight:** short dark grip, red caps and bright forward lens survive every tier. The far head is octagonal and grip bands disappear; it is less flared than the supplied reference. The shipped Halligan is a general hand-prop pipeline peer. Final Scene Lab inspection shows the corrected head/bezel seam, with no coplanar flicker observed. Beam rendering remains runtime work.

Concrete tradeoffs remain: far facial eyes and hair are angular, group packs lose tailoring, and soot on pale clothing reads more subtly than the wraps at the smallest camera size. These are honest visual limitations for independent orchestrator review; automated budget checks do not assert art acceptance. Sam’s crown tuft was retained after the first unit run found a shortened adult silhouette. Final member heights are 1.777–1.800 m across tiers and the adult-height test passes.

## Commands and results

Part1 delivered the station and flashlight using sequential per-ID build, pack and validate commands. This completion preserved those exports, then ran fresh validation and visual/Scene Lab capture. The stock build commands were run individually during modeling:

```sh
npm run assets:build -- npc.civilian-elderly.aftermath
npm run assets:build -- npc.paramedic.aftermath
npm run assets:build -- npc.civilian-woman-a.aftermath
sh assets/npc.survivor-group.aftermath/finish-batch.sh
```

`finish-batch.sh` builds the group, then sequentially builds/packs/validates Dale, Sam, cap-woman and bun-woman. It finally packs/validates each of the four stock IDs. Each pack uses the authored source LODs, without `--regenerate` or a global repack. Final selected checks: 24 skin/member tiers, zero failures. Station/flashlight were included in fresh global validation and all 30 batch metrics.

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 3353 --strictPort --configLoader runner
E2E_PORT=3353 SCENE_PORT=3353 SCENE_SERVER=preview E2E_SLOTS=2 E2E_WAIT=1 sh tools/e2e-lock.sh sh assets/npc.survivor-group.aftermath/qa-batch.sh
npx tsx assets/npc.survivor-group.aftermath/metrics.ts
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh . -- npm run test:unit -- --maxWorkers=4
```

`qa-batch.sh` runs the six requested IDs through standard `assets:turntable -- <ids> --lod-contact`, captures all ten actual outputs and shipped peers, composes reference sheets, then runs `npm run scene -- assets/int.metro-station/qa-scene.json assets/util.flashlight/qa-scene.json assets/npc.survivor-group.aftermath/qa-scene.json --backend webgl2 --size 1280x720 --out test-results/l5-shelter-arrival-and-skins/scene-lab`. One headless Metal WebGL2 browser ran under the shared lock. The initial slot-0 lock was occupied by another lane; this job used shared slot 1 via `E2E_SLOTS=2`, with no extra server on 3300. Only the owned port-3353 preview was stopped afterward.

Final results: global asset validation **976 checks / zero failures**; typecheck, lint and production build **passed**; remote unit suite **109 files / 391 tests passed, zero failures**; Scene Lab **3 scenes / 6 assertions passed**, 30 frames per scene, zero console errors, undrawn frames or reported static/actor clipping. The first unit run had one Sam height failure, fixed before the successful final rerun. Repeated builds of all four stocks preserved the repository’s canonical geometry/winding hash for all twelve tiers. Seven raw GLB byte hashes changed because Blender reordered exported vertex/accessor data; byte-identical raw exports are not claimed. `determinism.json` records the twelve matching canonical geometry hashes. Validated packed production outputs were retained unchanged after this check.

No level/gameplay systems were changed in this completion, so `test:smoke` and `verify E23/E24` are not applicable. No level epic implementation is claimed. The inherited part1 dev viewer fog adjustment and station fixed stair colliders remain preserved; the final production build and unit suite cover them.

## Evidence and handoff

For each requested ID and each separately extracted member, `test-results/l5-shelter-arrival-and-skins/<id>/` retains:

- `game-reference-peer.jpg`: reference, every tier and shipped peer at 135/190 px.
- `reference-lod-contact.jpg`: reference beside five matched-framing views for every tier.
- `loading.json`: actual ID/LOD loading record.
- The six requested IDs also retain standard `lod-contact.png` / `.json`.
- Station, flashlight and survivor group retain final `scene-lab.jpg`; metrics are in sibling `scene-lab/<scene>/metrics.json`.

Sheets are at most 1600 px wide. All ten game sheets were copied as JPG to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`. Temporary capture frames, videos and raw build intermediates were removed. Batch measurements and validation counts are retained in `metrics.json` and `validation-summary.json`.

References were visually inspected before modeling. Specifications, protected references, folio, drafts and experiment were not edited. The art brief was absent from the worktree and read from the main workspace; no replacement spec was invented. No push, merge into main or deployment. No remaining technical delivery blockers; independent visual acceptance and manual WebGPU QA remain with the orchestrator. Named-cast/runtime lanes must choose aliases, place shelter dressing, mount the flashlight and implement arrival behavior using the documented anchors.
