# art-l2l3 · P1 rescue/collapse assets · 2026-10-07

Commits: `14d9bbc8` (variant/LOD validation and tooling), `09a68a75` (15 integrated asset IDs, 3 declared wreck variants, sources/runtime exports and metadata).

Built the requested fire-station bay, axe rack, Halligan, motorized checkpoint boom, Jersey barrier, crowd fence, armory table, civilian evac coach, army checkpoint, three collapse dressing sets and the three formerly reference-only dressing sets. Added `wrecked` to red/blue sedans and police sedan via `decayVariants`. Sources and all runtime tiers are committed. All LODs are authored; no generic triangle decimation is used for this set. Palette/vertex AO only, no new textures/dependencies.

The bay has a clear fire-engine parking aisle, lockers, radio desk, kitchen and benches plus rotating red alarm anchors. The coach carries seated adult silhouettes, EVAC lettering, twelve seat sockets, four wheel pivots, a door pivot, driver/exit sockets and head/brake anchors. The army kit has T walls, razor wire, sandbag nests, watchtower/ladder, loudspeaker and floodlight anchors. `ss_physics` and compound collider empties accompany physical assemblies; generated runtime light/physics/collision tables are current.

## Runtime triangles and reviewed contact sheets

Every sheet is 1440 × 1800 PNG, five angles with LOD0/1/2 columns, captured through the game renderer with headless Chromium WebGL2/ANGLE Metal. All eighteen sheets were viewed; AO, coach cabin, shard overlap and wreck hood/glazing were refined after review. The sheets stay under the git-ignored lane evidence directory for Opus independent QA.

| Asset | LOD0 | LOD1 | LOD2 | Contact sheet |
| --- | ---: | ---: | ---: | --- |
| `int.fire-station-bay` | 2,812 | 768 | 468 | `test-results/art-l2l3/int.fire-station-bay/lod-contact.png` |
| `prop.axe-rack` | 396 | 60 | 60 | `test-results/art-l2l3/prop.axe-rack/lod-contact.png` |
| `wpn.halligan` | 220 | 60 | 60 | `test-results/art-l2l3/wpn.halligan/lod-contact.png` |
| `prop.checkpoint-gate` | 396 | 108 | 108 | `test-results/art-l2l3/prop.checkpoint-gate/lod-contact.png` |
| `prop.jersey-barrier` | 160 | 64 | 28 | `test-results/art-l2l3/prop.jersey-barrier/lod-contact.png` |
| `prop.crowd-fence` | 572 | 156 | 108 | `test-results/art-l2l3/prop.crowd-fence/lod-contact.png` |
| `prop.armory-table` | 440 | 120 | 96 | `test-results/art-l2l3/prop.armory-table/lod-contact.png` |
| `veh.evac-bus` | 3,306 | 1,354 | 1,066 | `test-results/art-l2l3/veh.evac-bus/lod-contact.png` |
| `kit.army-checkpoint` | 15,576 | 3,864 | 696 | `test-results/art-l2l3/kit.army-checkpoint/lod-contact.png` |
| `decay.looted-store` | 792 | 216 | 156 | `test-results/art-l2l3/decay.looted-store/lod-contact.png` |
| `decay.damaged-sign` | 264 | 72 | 36 | `test-results/art-l2l3/decay.damaged-sign/lod-contact.png` |
| `decay.makeshift-barricade` | 440 | 120 | 120 | `test-results/art-l2l3/decay.makeshift-barricade/lod-contact.png` |
| `decay.broken-glass` | 120 | 120 | 120 | `test-results/art-l2l3/decay.broken-glass/lod-contact.png` |
| `decay.boarded-windows` | 688 | 96 | 96 | `test-results/art-l2l3/decay.boarded-windows/lod-contact.png` |
| `decay.dropped-belongings` | 352 | 96 | 60 | `test-results/art-l2l3/decay.dropped-belongings/lod-contact.png` |
| `veh.sedan-red.wrecked` | 3,392 | 3,332 | 1,368 | `test-results/art-l2l3/veh.sedan-red.wrecked/lod-contact.png` |
| `veh.sedan-blue.wrecked` | 3,328 | 3,268 | 1,956 | `test-results/art-l2l3/veh.sedan-blue.wrecked/lod-contact.png` |
| `veh.police-sedan.wrecked` | 3,665 | 3,605 | 1,799 | `test-results/art-l2l3/veh.police-sedan.wrecked/lod-contact.png` |

## Validation

- `npm run assets:validate`: 721 checks, 0 failures (including all declared variant tiers).
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run test:unit -- --maxWorkers=4`: 87 files / 284 tests passed, 0 failed.
- `npm run assets:lights`: 291 anchors in 72 assets, 0 errors, 0 unreferenced emissive meshes.
- `npm run assets:pack -- veh.evac-bus`: pass, 0 generated LODs (authored tiers retained).
- `npm run assets:collision` and `npx tsx tools/assets/physics-metadata.ts`: pass. Initial metadata freshness failures were corrected; authored negative zero is canonicalized before comparison with serialized tables.
- `npm run assets:build -- prop.checkpoint-gate`: repeated actual Blender build gives the same geometry hash `0ac0202b9a64ace9adb87cb300c36c714857b014bb3ed84f653d47814ce4e6ab`.
- `npm run assets:build -- veh.police-sedan --decay wrecked`: pass; source and all three runtime tiers validate.
- `sh tools/e2e-lock.sh npm run assets:turntable -- <15 asset IDs> --lod-contact --output test-results/art-l2l3`: 15 sheets; `--decay wrecked` for red/blue/police sedans: 3 sheets. All final sheets inspected.
- `E2E_PORT=3315 npm run verify -- E17`: pass: typecheck, lint, production build; tagged Node suites 41 passed / 684 skipped / 0 failed; headless browser suite 39 passed / 0 failed (Chromium, phone portrait/landscape viewports and WebKit).

## Deviations and remaining work

No specs were edited. Wreck LOD0 is derived from the already-authored native LOD1 car foundation, with new impact geometry, to respect the lane's 15k cap; LOD1/2 use their corresponding existing native sources. Interiors and the Halligan also ship LOD2 so every requested contact sheet has all three columns.

Full inventory validation originally failed on the unrelated opt-in skinned courier. Its existing documented compressor deliberately uses lossless meshopt because quantization rescales the skinned mesh outside skin transforms. The global export scan now permits that existing skinned path to omit quantization; rigid exports still require meshopt and quantization. Its GLB/source were not changed.

Independent Opus visual QA and L2/L3 placement are pending; manifest statuses are integrated, not final. Gameplay animation/interaction wiring for gate/door/seat sockets is owned by the level lanes. Manual WebGPU parity is pending. No merge, push or deployment was performed.
