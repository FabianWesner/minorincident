# L5 burned service vehicles — lane delivery

Four base-owned burned variants, derived from the integrated pickup, police sedan, ambulance and school-bus native authored tiers. Source, raw GLBs, compressed production GLBs, manifest registrations and per-ID wrappers are committed in this scheduler lane. No runtime/gameplay, placement, mission, sound or switching code changed.

Delivery retains door, axle/wheel, driver-seat, exit and existing seat anchors. Three authored tiers per variant; 15k/6k/2k triangle caps, eight total draws. Wreck lights are cold. No active flames, emitted light records, decimation, AABB fitting, regeneration, new texture atlas or dependencies. The new per-variant budget field enforces the burned police budget without changing its existing 20-draw wreck.

## Measured production files

| Variant | Tier | Triangles | Draws | Materials | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| veh.pickup-red.burned | LOD0 | 4206 | 8 | 5 | 99380 |
| veh.pickup-red.burned | LOD1 | 4106 | 8 | 5 | 97504 |
| veh.pickup-red.burned | LOD2 | 1693 | 8 | 5 | 45320 |
| veh.police-sedan.burned | LOD0 | 4040 | 7 | 4 | 93068 |
| veh.police-sedan.burned | LOD1 | 3934 | 7 | 4 | 91044 |
| veh.police-sedan.burned | LOD2 | 1820 | 7 | 4 | 46932 |
| veh.ambulance.burned | LOD0 | 4308 | 8 | 5 | 94092 |
| veh.ambulance.burned | LOD1 | 4074 | 8 | 5 | 91188 |
| veh.ambulance.burned | LOD2 | 1866 | 8 | 5 | 48592 |
| veh.school-bus.burned | LOD0 | 4694 | 8 | 5 | 98112 |
| veh.school-bus.burned | LOD1 | 4088 | 8 | 5 | 88504 |
| veh.school-bus.burned | LOD2 | 1618 | 8 | 5 | 42544 |

## Commands and checks

The following ran sequentially per base ID, with no global repack or regeneration:

```sh
npm run assets:build -- veh.pickup-red --decay burned
npm run assets:pack -- veh.pickup-red
npm run assets:validate -- --ids veh.pickup-red
npm run assets:build -- veh.police-sedan --decay burned
npm run assets:pack -- veh.police-sedan
npm run assets:validate -- --ids veh.police-sedan
npm run assets:build -- veh.ambulance --decay burned
npm run assets:pack -- veh.ambulance
npm run assets:validate -- --ids veh.ambulance
npm run assets:build -- veh.school-bus --decay burned
npm run assets:pack -- veh.school-bus
npm run assets:validate -- --ids veh.school-bus
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh . -- npm run test:unit -- --maxWorkers=4
```

Final full asset validation: **862 tier reports passed, zero failed**. All 12 new burned tiers pass their 15k/6k/2k and eight-draw caps. Typecheck and lint pass. Each raw geometry hash matches its repeat Blender build (4/4); both final glazing recipes were rebuilt after the correction. A direct GLB audit checks total draws including wheels, materials, bytes, dark light state and inherited anchor positions against each integrated native tier. A deliberate zero-draw burned-only police budget rejects all three burned tiers while leaving six intact/wrecked tiers valid. Unit result is recorded below when the queued remote run completes. Smoke and epic verification do not apply to this asset-only delivery.

## Evidence

Preview built with `npm run build`; the lane-owned preview server used port **3327**. Every browser capture ran headless with `--use-angle=metal` through `tools/e2e-lock.sh`, one browser/page, no headed windows.

Per base ID:

```sh
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay burned --lod-contact --output test-results/l5-burned-service-vehicles
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay burned --output test-results/l5-burned-service-vehicles
```

Each directory has an all-side reference/turntable sheet, five-view matching-framing authored LOD sheet, and burned-reference/LOD0/LOD1/LOD2/intact-peer game-camera sheet at **135 and 190 px** (FOV25°, azimuth45°, polar0.30π). All images are ≤1500 px wide. Individual temporary captures were removed; required sheets and their JSON evidence remain.

- `veh.pickup-red.burned/comparison.png`
- `veh.pickup-red.burned/lod-contact.png`
- `veh.pickup-red.burned/game-reference-peer.jpg`
- `veh.police-sedan.burned/comparison.png`
- `veh.police-sedan.burned/lod-contact.png`
- `veh.police-sedan.burned/game-reference-peer.jpg`
- `veh.ambulance.burned/comparison.png`
- `veh.ambulance.burned/lod-contact.png`
- `veh.ambulance.burned/game-reference-peer.jpg`
- `veh.school-bus.burned/comparison.png`
- `veh.school-bus.burned/lod-contact.png`
- `veh.school-bus.burned/game-reference-peer.jpg`

All three sheets per variant were also copied as JPGs to:
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`.

## Lane visual review and limits

The sheets were inspected. Compared with the intact peers, missing roof sections, open cabin frames, folded panels, missing lamps, ruined tyres and charcoal/rust face regions produce an obvious damaged silhouette at both pixel sizes. The pickup keeps its red cab/bed identity; the ambulance keeps its box/cab split, stripe and medical mark; the bus keeps its long passenger shell and bonnet. LOD2 keeps the primary damage while simplifying folds, trim and cabin/debris detail.

Concrete visual limits: the police shell is very dark at 135 px and its lettering is hard to read; its LOD2 exposes more light door paint than near/mid. Rust/soot patches are broad/angular palette regions and less mottled than the references. These limits are described in each asset's `review.md`. Independent orchestrator visual acceptance is pending; these are lane observations, not final art sign-off.

Population minimums remain level placements. The bus's survivor cue/interaction belongs to the level lane; driver-seat/exit/door anchors remain available. Fire/smoke FX are not baked into these cold wreck meshes. No spec edits or forbidden-reference edits. No merge into main, push or deploy.

## Commits

- `9f5d558f` — per-variant delivery budget enforcement.
- `3845387b` — native-derived burned meshes, wrappers and registration.
- `6a798078` — remaining bus/ambulance pane removal and lane reviews.

## Unit result

Pending remote runner slot.
