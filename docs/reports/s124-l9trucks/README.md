# s124 — L9 truck ground patches and evacuation

Both defects are fixed. Final implementation: `b8b5ca9d` (five focused fix commits since `266ec466`). The pink patches were screamer pulse geometry: the original 20 m pulse used an 18%-wide pink ring, painting a 3.6 m band across the ground. It now keeps the same radius with a roughly 20 cm stroke at 25% opacity. Zombie health, speed, damage, attacks and hearing are unchanged; corpses persist.

## Ground reproduction and visual check

Reproduced from the committed crowded-trucks fixture on WebGPU, LOW/zoom 1.5 and HIGH. The fixture's native screamers emit pulses during the sampled seconds. Alternating quality exposed the timed pulses; quality switching itself was not the cause. Removing the VFX group eliminated the patches, while retaining the same simulation. The matching source is `Vfx.effect('screamer')`, fed by native scream noise events.

Personally inspected matched before/after frames and all four backend/tier views. Before: broad, opaque lilac arcs cover roads, verges and the truck area. After: narrow, subdued pulse outlines preserve the ordinary grey-purple paving and visible road markings. The matched LOW frame and HIGH frame lose their broad bright-pink areas. Six pulse samples per backend cover LOW/HIGH three times each: all 12 after samples contain zero pixels meeting the bright-pink detector. The before HIGH sample contains 190,108 such pixels. The detector is a regression aid, not a general image-quality metric.

[Before/after and backend sheet](before-after.jpg). Ground panels use the same fixture, camera, simulated frame and pulse timing. The evacuation comparison shows the original-source 2/4 wait and recovery from that saved state. Smoke/crowd occlusion remains visible; neither corpses nor enemies were culled to obtain the result.

## Evacuation causes and changes

- Passenger release could wait 90 s although defence finished at 30 s. The clear-door wait now ends with defence, preserving the 45-tick exit stagger.
- Rosa and the corgi could choose clear meeting points on opposite sides of the APC. Prefer paired space beside Rosa, and stop an unstarted goodbye from holding the queue after defence.
- Crowded rear exits exhausted their search. Extend the existing collision-checked animated exit search during evacuation.
- Three civilian separation passes could undo the entire forward walking step while most crowded infected received one. Evacuating civilians now use one pass too; physical contact radii remain unchanged.
- After defence, retain a nearby clear truck destination through the sit-down animation, instead of crossing the camp toward a distant roster slot or changing destination as the usable list changes. Boarding records the truck actually reached. Failed approaches discard stale paths.

## Native timing

Seed 1, full `L9-default` dry shortcut, native completion driver, actual WebGPU LOW/HIGH, zoom 1.5. Every fixed tick advances the VFX clock. Passive strips courier attacks and protects courier damage, matching the existing passive harness; it is not an unprotected stationary-player test. One-second observations are upper bounds.

| Tier | Policy | Defence complete tick | All4 aboard / evacuation done | Seconds after defence |
|---|---|---:|---:|---:|
| LOW | skilled |8554|8640|1.43|
| LOW | passive |8552|9660|18.47|
| HIGH | skilled |8648|8700|0.87|
| HIGH | passive |8669|9780|18.52|

All four evacuees remain human and alive. HP 100 each, except HIGH passive: 100/55/75/100. Sam and the corgi are seated in the APC. The reproduced earlier LOW shortcut remained3/4 beyond 360 s. A separate real keyboard/mouse production run on the earlier evacuation fix handed over to L10 in 196 s.

The original 266ec466 build, with courier protection for diagnosis, reproduced 2/4 through the 240 s cap. Its resumable crowded state is committed as `tests/fixtures/saves/qa/s124-l9-crowded-trucks.json.br`(141 KB). This legacy state was already 48 s past defence completion: all four backend/tier replays recover 4/4 human evacuees in 26 s after restoration. That catch-up measurement is separate from the fresh-run defence timings above.

## Validation

- Typecheck and lint pass.
- Unchanged remote `npm test`:150/150 manifest cases, 27 files, 105 passed/1 skipped, 127.7 s within 240 s on 46.225.66.90. No tests trimmed.
- `npm run verify -- E31` passes remotely; its receipt is pulled to `test-results/epics/E31/checks.json`.
- L9 threat audit: skilled flags [], passive flags []. The top-level receipt retains `PARTIAL_LEVEL_SELECTION` because only L9 was requested; this is not an all-campaign zero-flag claim.
- L9 vehicle-motion gate: HIGH/LOW pass, stable matching runtime hashes, no correction failures. HIGH 935 samples/31 grounded, max/p95 1.8/1.8 cm; LOW 1285 samples/35 grounded, 6.2/1.4 cm. Its 9000-frame windows cover driving/detour/rail/hatch rather than final evacuation.

`results.json` records timings, pulse pixel counts, fixture outcomes, hashes and validation receipts, under 200 KB. Only one small sheet is committed. No deployment, push, main movement, prohibited asset edits or dependency changes.

## Reproduce

```sh
SCENE_PORT=4985 L9_TIER=high L9_PASSIVE=1 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/s124-l9-trucks.ts
SCENE_PORT=4985 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/s124-screamer-ground.ts
```

Set `L9_BACKEND=webgl2` for the WebGL2 pulse check. The native probe also supports `L9_TIER=low`, `L9_REALTIME=1`, or `L9_FIXTURE=tests/fixtures/saves/qa/s124-l9-crowded-trucks.json.br`; use `L9_OUT` to preserve separate runs. All browser work is headless through the shared pool, one browser at a time, Metal, ports 4985/4986, reservations under 10 min.
