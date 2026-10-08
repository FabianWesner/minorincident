# L2/L3 asset QA rebuild — 2026-10-07

Commit `03304a15` rebuilds all six revised assets: populated fire-station hero interior, readable wrecked red/blue/police sedans, fortified army checkpoint and merchandise-strewn looted store. Authored near/mid/far source and optimized runtime GLBs, manifest footprints, light anchors, physics metadata and collision generation are current. No generic decimation, specs changes, new dependencies or changes to PASS asset recipes. `main` was already an ancestor when work started (3 lane commits ahead, 0 main commits ahead); no merge was needed. Nothing was pushed, merged to main or deployed.

## Runtime triangles

| Asset | LOD0 | LOD1 | LOD2 |
| --- | ---: | ---: | ---: |
| `int.fire-station-bay` | 15,096 | 6,300 | 3,244 |
| `kit.army-checkpoint` | 19,394 | 4,946 | 1,330 |
| `decay.looted-store` | 1,068 | 524 | 180 |
| `veh.sedan-red.wrecked` | 3,056 | 2,996 | 1,204 |
| `veh.sedan-blue.wrecked` | 2,964 | 2,904 | 1,856 |
| `veh.police-sedan.wrecked` | 3,352 | 3,292 | 1,597 |

These are actual GLB triangle counts. Preview `info()` includes one additional ground triangle. All original caps are retained: station 40k/15k/4k, checkpoint 30k/12k/4k, store 1.5k/600/200, wrecks 15k/6k/2k.

## Changes and visual review

- Station: open/closed roll-up doors, populated lockers with helmets/jackets/boots, coils/hose rack, slide pole, tools/workbench, SCBA rack, dispatch desk/screens, kitchen table/chairs, benches, board, parking stripes/drain, four ceiling fixtures with anchors, two rotating red beacon anchors and station signage. The engine parking aisle stays clear. Distant lettering is shortened to 02 to retain the existing 4k cap; near RESCUE lettering faces the bay facade.
- Wrecks: stronger front compression, accordion hood, removed driver-side door meshes, exposed dark cabin, soot, detached bumper/door debris/glass, missing front-left tire with bare hub preserving the animated wheel contract. Police bar is torn at one end and crushed/tilted toward the roof, while brake lamps stay on the vehicle. Intact sedan source/runtime GLBs are unchanged.
- Checkpoint: expanded T walls, two sandbag ring MG nests, razor coils at near/mid distance, boom gate, four floodlights and military tent. Additional solid wall/tent/boom collider pieces remain separate from the traversable footprint.
- Store: empty shelves plus a toppled shelf, 16/12/4 loose boxes by LOD, and near/mid cans/bottles.

Six five-angle, three-LOD contact sheets were regenerated and inspected in the headless game renderer (ANGLE/Metal). Authoritative evidence and checklist C/E review: `test-results/epics/E17/art-l2l3-qa/`. Copies also replace the six previous sheets under `test-results/art-l2l3/`. Lane verdict PASS; Opus independent asset QA remains pending. See the adjacent machine-readable `art-l2l3-qa.json`.

## Validation

- `npm run assets:build -- int.fire-station-bay`, `npm run assets:build -- kit.army-checkpoint`, `npm run assets:build -- decay.looted-store`: PASS, all three authored tiers each.
- `npm run assets:build -- veh.sedan-red --decay wrecked`, `npm run assets:build -- veh.sedan-blue --decay wrecked`, `npm run assets:build -- veh.police-sedan --decay wrecked`: PASS, all three authored tiers each.
- `npm run assets:validate`: PASS, 721 checks / 0 failed.
- `npm run typecheck`, `npm run lint`, `npm run build`: PASS.
- `sh tools/e2e-lock.sh npm run test:unit -- --maxWorkers=4`: PASS, 87 files / 284 tests / 0 failed, repeated after final metadata changes.
- `npm run assets:lights`: PASS, 297 anchors / 72 assets / 0 errors / 0 unreferenced emissive meshes.
- `npx tsx tools/assets/physics-metadata.ts`, `npm run assets:collision`: PASS.
- Repeat `npm run assets:build -- int.fire-station-bay`: PASS, geometry hash matches `9a462ee57375c1d844ea0da458017133c3f4dd53bd01f66ce02b3bb9bde10de0`.
- `sh tools/e2e-lock.sh npm run assets:turntable -- int.fire-station-bay,kit.army-checkpoint,decay.looted-store --lod-contact --output test-results/epics/E17/art-l2l3-qa`; corresponding red/blue/police command with `--decay wrecked`: PASS, six sheets; final station/police sheets refreshed after the last revisions.
- `E2E_PORT=3314 sh tools/e2e-lock.sh npx playwright test --grep '@(?:E17)(?:-AC\d+)?(?=\s|$)|@smoke(?=\s|$)' --workers=2`: PASS, 39 passed / 0 failed / 0 skipped (Chromium, four phone orientations, WebKit).
- `E2E_PORT=3314 npm run verify -- E17`: BLOCKED at its shared `sim-lock.sh` stage. Typecheck/lint/build passed. Both shared slots were held by other lanes' long-running L1 jobs, so this lane's queued process was stopped (exit 143) before Node tests started. Shared jobs were left running. The matching browser stage was run separately and passed as recorded above. The Node E17/smoke stage and a green end-to-end verify command remain unverified in this run.
- `git diff --check`: PASS.

## Deviations and remaining work

No spec deviations or relaxed budgets/tolerances. Checkpoint/store dimensions were updated from measured exports because their requested additions enlarge the footprints. Station distant lettering and the bare axle hub are authored delivery choices.

Remaining: rerun `npm run verify -- E17` once a shared sim slot is available; Opus independent contact-sheet approval; manual WebGPU and final district composition/lighting review by integration. No gameplay changes were made. Historical sandbox failures in `art-l2l3-qa-blocked.md` are resolved by this rebuild; the shared simulation queue is a separate validation limitation.
