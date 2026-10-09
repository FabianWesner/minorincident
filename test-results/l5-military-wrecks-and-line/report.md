# L5 military wrecks and defensive line delivery

## Delivery

Four requested IDs delivered on `lane/build-l5-military-wrecks-and-line`. Vehicle wrecks are base-owned decay variants: `assets/<base>/model.wrecked[.lod1/.lod2].glb`, `public/assets/models/<base>.wrecked[.lod1/.lod2].glb`. Each dotted ID has a build wrapper, with no conflicting canonical runtime mesh. Checkpoint uses canonical `model[.lod1/.lod2].glb` paths. Manifest registration includes authored caps, nodes, sockets, collider/physics metadata and production paths. No specifications, references or runtime district/mission logic edited. Main remained `6fe5319f`.

Military damage derives from shipped integrated base GLBs and their authored distance geometry. Near recipes weld import seams and bevel actual manufactured edges; distance recipes explicitly omit detail and reduce authored damage shapes. No decimation or regeneration. Static pieces batch with preserved palette vertex colors; protected wheel/turret/gun owners survive. Wreck light records are disabled and lenses have no emissive material. Heavy wrecks are not kickable/pushable.

## Measurements

Production measurements from GLB primitives (not the preview's extra presentation draw). Every tier has one material. Vehicle triangle caps are 15000 / 6000 / 2000; checkpoint caps are 1500 / 600 / 200. Draw caps: tank 8, truck 8, checkpoint 8; APC has the permitted explicit per-asset 9 override to retain body, six wheel owners including the bare front-left hub, turret and gun. Integrated base budgets were not widened.

| ID | LOD | Triangles | Draws | Materials | Source bytes | Production bytes | Measured X/Y/Z (m) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| veh.tank.wrecked | 0 | 8968 | 3 | 1 | 830044 | 175904 | 9.618/3.292/3.535 |
| veh.tank.wrecked | 1 | 3082 | 3 | 1 | 201008 | 49060 | 9.622/3.294/3.538 |
| veh.tank.wrecked | 2 | 1532 | 3 | 1 | 104528 | 28976 | 9.622/3.275/3.529 |
| veh.military-apc.wrecked | 0 | 6814 | 9 | 1 | 618188 | 145264 | 5.524/3.276/3.000 |
| veh.military-apc.wrecked | 1 | 2188 | 9 | 1 | 149336 | 38744 | 5.240/3.279/3.000 |
| veh.military-apc.wrecked | 2 | 744 | 9 | 1 | 56900 | 21052 | 5.240/3.162/2.995 |
| veh.military-truck.wrecked | 0 | 11019 | 7 | 1 | 1018324 | 212544 | 6.490/3.522/2.885 |
| veh.military-truck.wrecked | 1 | 3601 | 7 | 1 | 255320 | 56996 | 6.490/3.522/2.894 |
| veh.military-truck.wrecked | 2 | 1205 | 7 | 1 | 93464 | 26656 | 6.467/3.550/2.894 |
| decay.abandoned-checkpoint | 0 | 800 | 1 | 1 | 60940 | 18108 | 5.545/1.200/3.878 |
| decay.abandoned-checkpoint | 1 | 360 | 1 | 1 | 27224 | 9772 | 5.568/1.200/3.902 |
| decay.abandoned-checkpoint | 2 | 196 | 1 | 1 | 15660 | 6836 | 5.568/1.200/3.882 |

Dimensions are actual exported bounds including detached damage pieces, with base pivots/anchors unscaled. Checkpoint manifest dimension tolerance is 0.1 m; vehicle variants retain the existing base registration/tolerance. Packed near APC/truck remove 7/5 degenerate triangles from raw 6821/11024 respectively. `delivery.json` records exact bounds, hashes and no validation errors for all 12 tiers.

## Visual review

All four references/fallbacks were inspected before modeling. Latest reference/LOD contact sheets, turntables and game-camera peer sheets inspected after packing. Sheets are at most 1600 px wide. Game framing is FOV25, azimuth45, polar0.30pi, with 135 and 190 px targets. There are 32 game-camera loading records, no placeholders or fallback events; 60 authored LOD angle views and 20 turntable views. Twelve JPG sheets copied into `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`.

- **Tank:** large near-side hull breach, missing side skirt/track run, loose track, skewed turret and bent barrel retained at all tiers. Initial skirts obscured damage and were removed. In the game comparison the breach/broken running gear separates it from the intact peer. Rear/far armor remains comparatively intact; dark preview lighting reduces small soot/edge detail. This is a localized battle wreck, not a completely collapsed shell.
- **APC:** front corner breach/slumped armor, absent front-left tyre with surviving named hub, broken gun position and dead cabin. Early whole-batch boolean caused floating far walls; corrected by isolating the closed hull component. All tiers preserve continuous surviving walls. The rear/far side is less damaged than the impact side. Reference is a four-wheel car; integrated peer is a six-wheel APC. Preserved integrated identity and livery instead of replacing it with the reference vehicle.
- **Truck:** crushed front/cab, open side doorway, removed glass, exposed interior/seat, slumped wheel, detached door and missing front canvas section. Early centroid deletion produced canvas slivers; replaced with a plane cut. Read original GLB color factors to correct washed-out imported livery. Game comparison has a conspicuous cab/canvas gap and dark metal against intact windows/lights and full canvas. Rear cargo bed and surviving canvas remain recognizable. No standalone damage reference exists: declared intact truck reference + E23 damage brief fallback, requiring orchestrator reference QA.
- **Checkpoint:** bent boom, toppled/broken concrete barrier, dark empty sandbag/HMG nest, fallen blue tarp/frame and scattered hardware. Close bags have beveled corners; far tier uses explicit solid blocks and keeps the ruined line silhouette within 200 triangles. It is much less organized than the integrated checkpoint peer. The reference emphasizes a fallen blue tent while the required military gate/nest determines this composition. Small paint chips and sandbag seams disappear at game size; larger toppled shapes carry the read.

Independent orchestrator visual acceptance remains pending. These notes do not claim acceptance.

## Interface anchors

Original root/body and wheel/turret/gun contracts remain. Original sockets/anchors survive even where the associated equipment is destroyed; they do not imply live gunfire or lighting. Front empties are at the +X forward face.

Truck adds `survivorSeat`, `survivorDoor` and `survivorExit` empties. Split cargo/engine/cab-back/cab-floor proxies leave the door/cab entry open. Runtime lane owns the survivor pose/interaction and actor-clearance integration; the asset provides a seated/crouched hiding space. All six truck wheels are now protected by base manifest required/animated nodes during packing. Intact truck source GLBs did not change; production metadata/collision hash regenerated after the owner fix.

Checkpoint provides `front`, `gateArm`, `hmgPosition` and `braceSlot` empties. It is a fixed destroyed prop, not an operable gate. Separate barrier/motor/end/nest proxies avoid blocking its entire empty footprint. Level lane owns placement/nav/sound/mission use.

## Commands and results

Run sequentially, never a global repack:

```sh
npm run assets:build -- veh.tank --decay wrecked
npm run assets:pack -- veh.tank
npm run assets:validate -- --ids veh.tank
npm run assets:build -- veh.military-apc --decay wrecked
npm run assets:pack -- veh.military-apc
npm run assets:validate -- --ids veh.military-apc
npm run assets:build -- veh.military-truck --decay wrecked
npm run assets:pack -- veh.military-truck
npm run assets:validate -- --ids veh.military-truck
npm run assets:build -- decay.abandoned-checkpoint
npm run assets:pack -- decay.abandoned-checkpoint
npm run assets:validate -- --ids decay.abandoned-checkpoint
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh . -- npm run test:unit -- --maxWorkers=4
```

Build/pack/selected validations: all successful, exit 0. Global validation: **862 records passed, 0 failed**, exit 0. Typecheck and lint: exit 0, no errors. Four explicit `--distance-tier 1 --glb <temporary-path>` rebuilds byte-identical to delivered LOD1 source: **4 passed, 0 failed** (`determinism.json`); temporary exports removed. No claim of an all-tier deterministic rebuild check.

Unit suite **blocked before execution**, not passed or failed: first remote snapshot waited over 18 minutes in a remote slot queue; final snapshot waited over 13 minutes for pool capacity. All three runners full. Automatic expansion failed in nbg1/fsn1/hel1 with `resource_limit_exceeded Primary IP limit exceeded`. A read-only diagnostic found a Vitest process occupying a runner for approximately two hours; no other lane was interrupted. Own queued/waiting requests are cancelled at handoff to avoid executing stale snapshots. Unit test pass/fail counts unavailable. Cancelled requests returned infrastructure exits 255 (remote session) and 69 (pool selection), not Vitest results. Rerun the exact remote command when pool capacity is restored. Logs retained here. Smoke/E23 verify were not run because no gameplay/level epic implementation changed.

Browser capture commands for each vehicle base and canonical checkpoint:

```sh
E2E_PORT=3357 sh tools/e2e-lock.sh npm run assets:turntable -- veh.tank --decay wrecked --lod-contact --output test-results/l5-military-wrecks-and-line
E2E_PORT=3357 sh tools/e2e-lock.sh npm run assets:turntable -- veh.tank --decay wrecked --output test-results/l5-military-wrecks-and-line
# Same two commands for veh.military-apc and veh.military-truck.
E2E_PORT=3357 sh tools/e2e-lock.sh npm run assets:turntable -- decay.abandoned-checkpoint --lod-contact --output test-results/l5-military-wrecks-and-line
E2E_PORT=3357 sh tools/e2e-lock.sh npm run assets:turntable -- decay.abandoned-checkpoint --output test-results/l5-military-wrecks-and-line
E2E_PORT=3357 sh tools/e2e-lock.sh npx tsx tools/assets/l5-military-evidence.ts
python3 tools/assets/l5-military-sheets.py
```

Headless Chromium Metal, one browser page. Own preview server on 3357 stopped at handoff; existing preview servers untouched. Temporary captures/exports removed; required sheets retained.

## Evidence paths

Each requested ID has `test-results/l5-military-wrecks-and-line/<id>/game-reference-peer.jpg`, `reference-lod-contact.jpg`, `turntable.jpg`, `lod-contact.png`, `comparison.png` and loading/capture JSON. `delivery.json` contains tier measurements; `validation-summary.json`, `determinism.json` and `logs/` document checks.

## Commits

- `e04fe85d`: built damage variants, checkpoint, export batching and registration.
- `82e879f8`: preserved all six truck wheel owners in production.
- `c3a4a24d`: beveled surviving near wreck panels.
- Final evidence/tooling commit follows this report. No push, main merge or deployment.
