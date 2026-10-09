# L6 service gates and lights

Four canonical assets delivered with authored LOD0/1/2 recipes. No decimation, added dependencies, district placement or gameplay-system implementation.

## Production measurements

| Asset | LOD | Triangles | Draws | Materials | Production bytes | Source bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| prop.service-gate | 0 | 1036 | 6 | 5 | 23620 | 82140 |
| prop.service-gate | 1 | 260 | 6 | 5 | 9916 | 25312 |
| prop.service-gate | 2 | 196 | 5 | 4 | 8528 | 20264 |
| prop.fluorescent-strip | 0 | 640 | 4 | 4 | 14116 | 49728 |
| prop.fluorescent-strip | 1 | 264 | 4 | 4 | 8228 | 22572 |
| prop.fluorescent-strip | 2 | 136 | 4 | 4 | 6716 | 14892 |
| prop.emergency-light | 0 | 580 | 5 | 5 | 14688 | 47180 |
| prop.emergency-light | 1 | 268 | 5 | 5 | 9084 | 23616 |
| prop.emergency-light | 2 | 156 | 5 | 5 | 7452 | 16460 |
| util.radio | 0 | 896 | 6 | 6 | 19756 | 70688 |
| util.radio | 1 | 232 | 6 | 6 | 8508 | 22056 |
| util.radio | 2 | 184 | 5 | 5 | 7456 | 18256 |

Caps: 1500/600/200 triangles, <=8 draws, <=8 materials, <=300 KiB. Manifest uses measured dimensions with 3% tolerance and explicit sourceScale=1. Runtime GLBs carry meshopt/quantization; semantic empties, protected gate pivot and emissive batches survive every tier.

## Commands and checks

For each canonical ID, sequentially:

```sh
npm run assets:build -- <id>
npm run assets:pack -- <id>
npm run assets:validate -- --ids <id>
E2E_PORT=3317 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --output test-results/l6-service-gates-and-lights
E2E_PORT=3317 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --lod-contact --output test-results/l6-service-gates-and-lights
```

All four build/pack/selected-validation sequences passed (12 production tiers). Each selected GLB tier was also probed for total primitive draws, physics class, light references and gate ownership/state extras. `npm run assets:lights`: 327 anchors in 85 assets, 0 errors, 0 uncovered emissive meshes. `npx tsx tools/assets/physics-metadata.ts` regenerated the root physics table. `npm run build` passed. Final full local `npm run assets:validate`: 874 records, 0 errors.

Four authored LOD captures passed. Fluorescent and emergency standard turntables passed. Gate and radio standard turntables returned exit 1 for the generic 10% pixel-area check: gate side coverage 2.9–3.25%, radio 6.21–8.46%. All five views and their comparison sheets were produced and visually inspected. No geometry was inflated to satisfy the area heuristic.

Headless Chromium used Metal WebGL2, one browser page, through the shared lock. A temporary preview server on 3317 was started after building and stopped after captures. Game-camera captures used FOV25, azimuth45, polar54 and matched distance for each asset across its LODs; actual longest screen extent was 135–197 px. No browser page errors/placeholders. Temporary renders and raw capture/build intermediates were removed.

The initial remote full check returned validation/typecheck/lint PASS, unit 364 PASS / 2 FAIL (104 files). Failures were registration follow-ups: stale generated physics metadata, and a production-gate test expecting the newly integrated radio to be missing. Physics metadata was regenerated; the test now accepts integrated radio and explicitly verifies that a reference-status copy is still rejected. Targeted locked regression run passed 4/4 tests in 2/2 files:

```sh
sh tools/sim-lock.sh node_modules/.bin/vitest run tests/unit/physics-metadata.test.ts tests/unit/assets/production-gates.test.ts --maxWorkers=2
```

Final remote check attempt (cancelled before sync after capacity remained unavailable):

```sh
sh tools/remote/run.sh . --pull test-results/l6-service-gates-and-lights/checks -- sh -c 'mkdir -p test-results/l6-service-gates-and-lights/checks; npm run assets:validate > test-results/l6-service-gates-and-lights/checks/assets-validate.log 2>&1; a=$?; npm run typecheck > test-results/l6-service-gates-and-lights/checks/typecheck.log 2>&1; b=$?; npm run lint > test-results/l6-service-gates-and-lights/checks/lint.log 2>&1; c=$?; npm run test:unit -- --maxWorkers=4 > test-results/l6-service-gates-and-lights/checks/unit.log 2>&1; d=$?; printf "validate=%s typecheck=%s lint=%s unit=%s\n" "$a" "$b" "$c" "$d"; exit $((a+b+c+d))'
```

The pool had all three runners full for >5 minutes. Adding capacity failed on provider placement and Primary IP limits. The queued retry was cancelled before sync and checks completed locally; heavy Vitest ran under the shared lock with two workers (deviation from the requested four-worker upper bound). Final commands, in order:

```sh
npm run assets:validate
npm run typecheck
npm run lint
sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2
```

PASS: 874 asset validation records, 0 errors; typecheck 0; lint 0; unit 366/366 tests in 104/104 files, 56.92 s. Logs are in `test-results/l6-service-gates-and-lights/checks/`.

No level epic was implemented and no runtime/gameplay implementation changed, so smoke and E24 verify were not run.

## Visual evidence and limitations

Under `test-results/l6-service-gates-and-lights/<id>/` for every ID:

- `comparison.png`: reference and all five LOD0 views.
- `lod-contact.png`: five matching views, columns LOD0/1/2.
- `authored-lod-reference.jpg`: reference above the LOD sheet.
- `game-reference-peer.jpg`: reference, all three LODs, integrated peer at 135 and 190 px.
- `turntable.json`, `lod-contact.json`, `game-camera.json`, `review.md`: capture/read evidence.

Game-reference-peer JPGs were copied to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/<id>-game-reference-peer.jpg`.

Self QA inspected every sheet. The first gate face was nearly black and tubes visually fused; bounded AO, brighter painted steel and a tube separator corrected those reads. Current limitations: gate front is cooler/darker than the green reference under the shared shader and its back is warmer; emergency core clips to pale pink but the red solid lens remains distinct; radio screen is passive and lower contrast than the reference. LOD2 keeps all required silhouettes, fittings and full panels with no perforation.

Peers: service gate -> prop.yard-gate; fluorescent -> prop.light-tower; emergency -> prop.light-tower-trailer; radio -> wpn.pistol. Fixture peers establish palette/emitter construction, not exact device matches. There is no standalone integrated radio peer; pistol only establishes handheld equipment readability. Source look is cleaner than the textured references because this lane uses shared palette and vertex colors. Orchestrator acceptance remains independent.

## Runtime handoff

See each asset notes.md for exact anchors. Gate leaf `gate`, closed/open center anchors, fixed `braceSlot`, moving `latchSocket`, hinge-owned `col:gate` with closed-only enabled/sight metadata; root `ss_gate` describes state. The generic generated staticCollision/physics tables represent the authored closed pose only; level/runtime must bind state-owned gate collision and sight to the moving leaf and disable the gate blocker when open. Asset metadata does not implement gate state or brace HP.

Fluorescent: `metro-main`, `light_fluorescent`, fluorescent flicker, `light:fluorescent`, `mountSocket`. Emergency: `metro-emergency`, `light_siren_red`, `light:emergency`, `mountSocket`. Lighting spacing <=15 m, power failure, independent shelter lights, sounds, NPC behavior and mission flow belong to the level/runtime lanes. Radio `audioSocket` / `ss_audio` is shelter dressing/static, with no new UI item.

No modeling blocker. The art-l2l3 brief was absent from this worktree and read from the main checkout. No specs/reference files were edited. Lane matched main at start (131f4835); no merge into main, push or deployment.

Commits: `e0795957` asset sources/models/manifest/evidence notes; `b2e457b0` generated registration data and production-gate expectation. Final report commit recorded in the delivery response.
