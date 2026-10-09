# L6 metro and shelter kit delivery

Lane: `build-l6-metro-and-shelter-kit`. Starting main was `131f4835`; no main updates required merging. Source commit: `3eed02ce`. Production/QA commit: `2e7d4427`; the final report commit is the commit containing this report. No push, main merge or deployment.

Four canonical assets delivered with per-ID build.py, source and production LOD0/1/2, actual manifest registration and generated light/physics records. No dependencies, atlas, runtime logic, specs or reference edits. Recipes reuse sslib.fairhaven and rescue-assets rigid-owner conventions; no generic decimation or --regenerate.

## Measured production tiers

Bytes are compressed production GLB bytes, not raw source export sizes. Draws count all material primitives, including the separately animated exitGate and emissive batches. Viewer renderer.info totals include one shared fullscreen presentation draw/triangle (all canonical captures show exactly +1); capture JSON retains original totals and adds explicit asset-only budget measurements.

| Asset | Tier | Triangles | Draws | Materials | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| int.metro-exit | LOD0 | 5,076 | 8 | 7 | 88,812 |
| int.metro-exit | LOD1 | 2,054 | 8 | 7 | 46,080 |
| int.metro-exit | LOD2 | 1,120 | 8 | 7 | 33,744 |
| kit.metro-tunnel | LOD0 | 3,418 | 8 | 7 | 68,876 |
| kit.metro-tunnel | LOD1 | 1,506 | 8 | 7 | 34,620 |
| kit.metro-tunnel | LOD2 | 962 | 8 | 7 | 26,636 |
| kit.maintenance-corridor | LOD0 | 2,844 | 7 | 7 | 52,932 |
| kit.maintenance-corridor | LOD1 | 1,700 | 7 | 7 | 35,092 |
| kit.maintenance-corridor | LOD2 | 1,056 | 7 | 7 | 26,680 |
| kit.shelter-camp | LOD0 | 2,668 | 8 | 8 | 46,856 |
| kit.shelter-camp | LOD1 | 2,044 | 8 | 8 | 39,152 |
| kit.shelter-camp | LOD2 | 1,428 | 8 | 8 | 30,480 |

All tier AABBs match their asset's measured dimensions; tolerance 3%, no export rescaling. Asset budgets: exit 40k/15k/4k; each kit 30k/12k/4k; all <=8 total draws and palette materials. Authored LOD1 removes bevel/trim; LOD2 reduces specified radial/tread/sleeper/quilt recipes and controls while retaining complete solids and apertures. Two final complete Blender builds matched all 12 geometry hashes (`geometryHash` from the existing validator). Detailed source/runtime metrics and hashes: `assets/<id>/report.json`.

## Interface and dependency notes

- Exit: +X is the platform approach so the fixed game camera sees the climbing flights. Night street socket is -X at Y=3.5. Separate stationary escalator, stairs, 2 m tall heavy gate, hinge-owned collider, brace slot, platform edge and NORTHGATE sign. Gate state and night preset are level/runtime interfaces.
- Tunnel: repeatable 12 m pitch, 7.6 m exterior/6.9 m clear width. Three actual 2.2 m side portals, two cross passages, three gate/brace interfaces and start/end sockets. Middle rib is on a solid pier, not across the centre opening. Near half vault is cut away; named roof owner remains hideable. E24 places its 200–260 m retreat route and the actual three main-route chokepoints; this delivery does not claim completed district layout.
- Maintenance: 10 m utility bay, two open 2.2 m room portals, equipment outside a 2.2 m aisle, pump-to-header connection and recognizable signal cabinets. Repeated modules connect through room/start/end sockets; gates stay separate `prop.service-gate` assets.
- Shelter: four rest mats, clear 1.4 m centre aisle, pillows/folded blankets, water pallet and independent warm lantern circuit. No embedded NPCs/behavior. Rest/share anchors support living adult survivors from their lane.
- Main strips use `metro-main` with fluorescent flicker, emergency lamps `metro-emergency`, camp lamps `shelter-camp`. Light records have valid tokens/ranges/cones/ground reach and surviving named emissive targets. All mounts/light nodes remain in every tier and production files. No Blender lights exported.
- Root ss_physics is fixed, mass=0, unpushable/unkickable, with named col:* empties. The animated gate collider is local to its hinge: door consumers must apply its world transform/state rather than use a fixed baked AABB for motion. Full connection coordinates and collider contracts are in each asset's notes.md.
- `int.metro-station` was absent from the merged main at start. These independent modules are delivered, but station attachment fit awaits the L5 dependency. No main/runtime lane changes were made to implement placement, lights switching, sounds, NPC routines or missions.

Final aperture correction moves jamb trim outside the opening, raises tunnel conduits/emergency lighting, and moves the signal-room opening and its pipe/valve apart. All 15 compressed tunnel side/gate and maintenance portal/tier combinations passed a conservative triangle-bounds intersection audit with a 20 mm margin (`apertures.json`). Tunnel side/gate interfaces clear 2.2 × 2.35 m; maintenance portals clear 2.2 × 2.6 m. Signal-room socket is X=3.3 m. Refreshed sheets and metadata reflect these final coordinates.

## Visual evidence and self-review

Each `test-results/l6-metro-and-shelter-kit/<id>/` contains:

- `comparison.png`: source reference plus four sides and game camera (1500 px wide).
- `lod-contact.png`: source reference plus all authored LODs at matching framing from 45/135/225/315/0 degrees (1440 px wide).
- `game-reference-peer.png`: source three-quarter reference, LOD0/1/2 and an integrated peer at 135 and 190 px maximum extent, FOV25°, azimuth45°, polar54° (1600 px wide).
- `game-reference-peer.json` / `lod-contact.json` / `turntable.json`: loading and capture evidence. No placeholder loads or page errors.

All sheets were inspected. Early faults corrected: unsupported exit lamps, undersized gate, stair occlusion at the required camera, an arch across the middle side portal, an unconnected pump outlet, and doorway trim/pipes/lamp fittings inside the declared clear portals. Concrete remaining limits: wall/retaining panels are plainer than textured references/trim-rich peers; textile folds are flatter, far LOD removes bottle labels and signage lettering. Essential platform/stair/escalator/gate, rail/arch/portal, pipe/pump/cabinet and mat/lamp/water silhouettes remain. Self-review PASS; independent orchestrator acceptance remains pending.

Peers: exit `bld.metro-entrance`, tunnel `bld.tunnel-portal`, maintenance `int.fire-station-bay`, shelter `kit.evac-camp`. Per-asset review.md states the comparison honestly, including broader/simpler surfaces and kit scope differences.

JPG copies of all three sheets per ID: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/<id>-{comparison,lod-contact,game-reference-peer}.jpg`. Temporary individual turntable/game renders and capture scripts are removed after sheets are assembled. Started preview only on 3327, stopping only that server at completion; initial 3317 attempt found an occupied port and made no change there. All browser captures headless, shared e2e lock, Metal WebGL2, one page; no WebGPU claim.

## Commands and results

For each ID, sequentially:

```sh
npm run assets:build -- <id>
npm run assets:pack -- <id>
npm run assets:validate -- --ids <id>
```

All four assets / twelve tiers passed. Repeated final builds also passed and source geometry hashes matched 12/12. `npm run assets:lights`: 336 anchors / 87 assets, 0 errors, 0 unreferenced emissive meshes. `node_modules/.bin/tsx tools/assets/physics-metadata.ts`: refreshed only the four new IDs. Physics table freshness was the sole initial unit failure (365 passed / 1 failed); regenerated before final checks.

```sh
npm run build
npm run assets:validate
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- int.metro-exit,kit.metro-tunnel,kit.maintenance-corridor,kit.shelter-camp --output test-results/l6-metro-and-shelter-kit
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- int.metro-exit,kit.metro-tunnel,kit.maintenance-corridor,kit.shelter-camp --lod-contact --output test-results/l6-metro-and-shelter-kit
```

Full asset validation: 874 tier records passed, 0 failed. Direct freshness assertion against the regenerated physics table passed; all 12 compressed tier light contracts have 0 errors and 0 unreferenced emissive nodes (`contracts.json`). Build passed. Game-scale capture uses the existing viewer deliveryView API under the same headless lock (temporary capture script), then Pillow assembles the reference/peer sheets. No implementation tests were added.

Final checks use the required remote runner:

```sh
sh tools/remote/run.sh . --env E2E_PORT=3329 -- sh -c 'npm run typecheck && npm run lint && npm run test:unit -- --maxWorkers=4 && npm run test:smoke'
```

Typecheck and lint passed. Unit tests: 104 files / 366 tests passed. Smoke simulation subset: 5 files / 6 tests passed (164 files / 864 tests skipped by smoke selection). Smoke browser suite: 20 passed / 5 failed; command exit 1. Outstanding failures:

| Project / test | Failure |
| --- | --- |
| Chromium controls-playtest S-02 | 60 s timeout at mouse.move, controls-playtest.spec.ts:14 |
| Chromium crowd-drawn WebGL | 120 s timeout taking canvas screenshot, waiting for stable element, crowd-drawn.spec.ts:45 |
| Chromium crowd-drawn WebGPU | Page error: Instance dropped in popErrorScope |
| Chromium menus-mouse | 60 s timeout waiting for menu-loading to hide, menus-mouse.spec.ts:9 |
| WebKit audio S-11 | Music position delta 0.0580498866 s exceeds 0.05 s, audio/smoke.spec.ts:70 |

These are L1 controls/UI/crowd/audio smoke paths; L6 assets are registered but not placed by this lane. Their baseline status is unproven, and they remain an outstanding smoke blocker. No runtime/test change was made to mask them. The default existing remote smoke script includes a Linux WebGPU test; this is not manual Mac WebGPU acceptance.

After final aperture fixes, typecheck/lint/unit checks were repeated on the final exports:

```sh
sh tools/remote/run.sh . -- sh -c 'npm run typecheck && npm run lint && npm run test:unit -- --maxWorkers=4'
```

Final repeat passed: typecheck, lint, 104 unit files / 366 tests; remote exit 0. Final `git diff --check` passed. Preview server started on 3327 has been stopped.

E24 verify not run: no level epic/mission/layout implementation in this asset lane. No budget or footprint exceptions. Dependency pending: station fit as noted above. All source/manifest/production exports, per-asset reports and this delivery report are committed on the lane.
