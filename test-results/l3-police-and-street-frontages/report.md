# L3 police and street frontages delivery

Lane: lane/build-l3-police-and-street-frontages. Build commit: 147d7a42. Main merged into lane: a5b9caf3 (e2964228).

All five requested IDs delivered. bld.police is a compatibility derivative of bld.police-station; bld.bus-stop.w2/w3 are base-owned variants without duplicate canonical manifest entries.

## Production measurements

Bytes are exact GLB bytes. Draws include every material primitive and animated station door. Preview info includes one extra screen presentation draw/triangle.

| ID | Tier | Triangles | Draws | Materials | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| bld.police-station | lod0 | 8,002 | 8 | 6 | 130,660 |
| bld.police-station | lod1 | 2,370 | 8 | 6 | 37,324 |
| bld.police-station | lod2 | 1,974 | 8 | 6 | 32,824 |
| bld.police | lod0 | 8,002 | 8 | 6 | 130,800 |
| bld.police | lod1 | 2,370 | 8 | 6 | 37,488 |
| bld.police | lod2 | 1,974 | 8 | 6 | 32,992 |
| bld.bus-stop.w2 | lod0 | 4,298 | 8 | 6 | 72,328 |
| bld.bus-stop.w2 | lod1 | 1,546 | 8 | 6 | 25,268 |
| bld.bus-stop.w2 | lod2 | 1,338 | 8 | 6 | 23,224 |
| bld.bus-stop.w3 | lod0 | 4,002 | 8 | 6 | 66,664 |
| bld.bus-stop.w3 | lod1 | 1,506 | 8 | 6 | 24,676 |
| bld.bus-stop.w3 | lod2 | 1,334 | 8 | 6 | 23,184 |
| decay.burned-facade | lod0 | 1,362 | 5 | 5 | 27,784 |
| decay.burned-facade | lod1 | 330 | 5 | 5 | 9,180 |
| decay.burned-facade | lod2 | 198 | 4 | 4 | 6,816 |
| bld.bus-stop | lod0 | 4,030 | 8 | 6 | 67,348 |
| bld.bus-stop | lod1 | 1,438 | 8 | 6 | 23,512 |
| bld.bus-stop | lod2 | 1,230 | 8 | 6 | 21,496 |

## Commands and validation

Commands run sequentially per canonical asset, all exited 0:

```sh
npm run assets:build -- bld.police-station
npm run assets:pack -- bld.police-station
npm run assets:validate -- --ids bld.police-station
npm run assets:build -- bld.police
npm run assets:pack -- bld.police
npm run assets:validate -- --ids bld.police
npm run assets:build -- bld.bus-stop
npm run assets:pack -- bld.bus-stop
npm run assets:build -- bld.bus-stop --decay w2
npm run assets:build -- bld.bus-stop --decay w3
npm run assets:pack -- bld.bus-stop
npm run assets:validate -- --ids bld.bus-stop
npm run assets:build -- decay.burned-facade
npm run assets:pack -- decay.burned-facade
npm run assets:validate -- --ids decay.burned-facade
npx tsx tools/assets/physics-metadata.ts
```

Blender 5.2.2 ran headless through run.py. All tiers are explicit recipes. No --regenerate, generic decimation, new dependencies or texture atlas. Final global commands/counts are recorded in checks.json.

Initial unit run: 339 passed / 2 failed (97 files). Failures exposed stale generated physics metadata and the legacy police dimensions. Both corrected. Next run before main merge: 341/341 passed. Final merged unit run uses the shared sim lock and two workers for the heavy-run limit. Smoke is also run because generated physics/collision registration changed. No E21 verify: this lane delivers assets, not level implementation.

## Evidence

Every listed directory has comparison.png (reference, four cardinal sides and game view), lod-contact.png (reference, matching LOD0/1/2 at four diagonal sides plus front), game-camera.png (reference, all tiers at approximately 150px; FOV25, azimuth45, polar0.30pi), loading.json / turntable.json / lod-contact.json. Station also has cutaway.png. Images are at most 1536px wide.

- test-results/l3-police-and-street-frontages/bld.police-station
- test-results/l3-police-and-street-frontages/bld.police
- test-results/l3-police-and-street-frontages/bld.bus-stop.w2
- test-results/l3-police-and-street-frontages/bld.bus-stop.w3
- test-results/l3-police-and-street-frontages/decay.burned-facade

Capture commands, through the shared lock:

```sh
E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- bld.police-station --lod-contact --output test-results/l3-police-and-street-frontages
E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- bld.police --lod-contact --output test-results/l3-police-and-street-frontages
E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade --lod-contact --output test-results/l3-police-and-street-frontages
E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- bld.bus-stop --decay w2 --lod-contact --output test-results/l3-police-and-street-frontages
E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- bld.bus-stop --decay w3 --lod-contact --output test-results/l3-police-and-street-frontages
sh tools/e2e-lock.sh npx tsx .cache/l3-evidence.ts
python3 .cache/l3-sheets.py
```

Standard cardinal views used captureTurntable; 150px checks used deliveryView. Headless Chromium, --use-angle=metal. Zero console/page errors; all tiers load without placeholders. Lane server on 3313 was stopped after capture. Temporary individual frames were deleted; required sheets and JSON remain.

Footprints: footprints.lod0.png / footprints.lod1.png / footprints.lod2.png and footprints.json. CPU projected triangle masks at 512px give IoU 1.0 for W2/W3 against base at every tier. All source shelter bounds match 2.0414 x 2.675 x 4.9692 m with the original origin.

## Deviations and concrete visual limitations

- Generic burned-facade reference is missing. Inspected brick/diner/house siblings; all three are shown in the sheets. Generic standing damaged shop profile uses their common opening/char language.
- Repaired existing shelter base because its source used generic decimation and loose caps. Original native roof/post/bench coordinates, width factor, orientation, footprint and pivot are retained. Map art and fasteners are simplified.
- Larger canonical station could not share a GLB under bld.police without breaking the existing D-CIVIC 10 x 5 x 8 m contract. Final aliasOf registration uses compatibility exports from the same authored tiers and one explicit assembly scale; no second design. Canonical L3 hero is 12 x 6.85 x 16 m.
- Fixed mirrored reverse poster text, too-similar W2/W3 glazing, and subtle W3 soot. W2 boards/bags and W3 smashed rear/side panes, damaged sign and broad char survive every tier.
- Text is subpixel at 150px. Broad blue civic entrance/badge, lower wing/yard and sandbag shapes remain; smashed glazing reads best from rear/side. Fine chain-link uses chunky rails. Generic facade LOD2 omits the awning but preserves charred openings and chipped standing profile.
- Initial 150px station capture at a very long distance was fog-washed. Final smaller viewport captures 150px at representative distance, with the specified FOV and angles.

Interfaces are documented in assets/<id>/notes.md: roof/interior cutaway owners, station doorMain and entrance/armory/yard/cover sockets, shelter entrance/bench/nav sockets, facade attachSocket, fixed ss_physics and col:* nodes. Generated physics/collision data is refreshed. No emitting fixtures are included. Police bridge checkpoint stays an existing-kit composition. District placement, NPCs, missions, nav, sounds and light switching stay with level/runtime lanes.

Independent orchestrator acceptance remains required. No asset-delivery blocker identified.

Final merged validation: 778 GLB/tier checks passed, zero failed. Typecheck and lint passed. Unit: 343 tests passed in 98 files, zero failed. Determinism: 18/18 source tiers reproduced identical geometry hashes. Bus base retains its existing stricter LOD1/LOD2 manifest caps (6000/3000); both variants satisfy these and the requested 12000/4000 ceilings.

Final smoke: six simulation tests passed (816 skipped), 25 headless browser tests passed (two workers), zero failed. Production build passed. The final commands were npm run assets:validate; npm run typecheck; npm run lint; sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2; npm run build; E2E_PORT=3313 npm run test:smoke. Post-merge two-worker unit run follows the heavy-run cap; the requested four-worker run also passed before merge.
