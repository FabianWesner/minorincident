# Footprints — 2026-10-11

Replaced the five-texel cross in the weather surface mask with alternating, travel-oriented shoe soles (28 cm adults, 20 cm children) and four-toe paws (12 cm corgi/pets/animal infected). Soles have a rounded heel, broader forefoot, inward arch and shallow tread. Tracks accumulate actual travel distance, use 50/36/23 cm step spacing, retain the existing ash/snow surface colours, and fade over 60 seconds. The generated two-mask atlas is 32 KiB; the ground field remains 4 MiB. A camera-centred 16 m field provides 1.6 cm texels and gently fades prints near its boundary. Updates run at 10 Hz, with no trigonometry in the raster loop and no actor traversal during clear weather.

The bridge/wall cause is in `WeatherView`: the original mask wrapped world X/Z every 64 m and ignored both surface height and normal. `WeatherSystem` also discarded the walker's height. Thus a recorded bridge track could appear on walls and the ground beneath it. Tracks now retain support height; the shader accepts matching upward-facing surfaces only, with separate ground/elevated layers and bounded coordinates. The emitter rejects unsupported feet, rides, vaults, perched animals, teleport gaps and a lateral foot crossing a support edge/barrier. The exact walker in the described production screenshot cannot be identified from its description; no navigation fault was reproduced.

The headless GPU fixture stamps at 6 m and measures 9,789 footprint pixels on the bridge surface, **0 below it**, **0 on a vertical wall**, and **0 at the old 64 m repetition**; no browser errors. See [surface evidence](surface-proof.json), [bridge](surface-bridge.png), [ground below](surface-ground.png) and [wall](surface-wall.png). Reproduce with `SCENE_PORT=3425 sh tools/e2e-lock.sh npx tsx tools/look/footprints-surfaces.ts`.

## Inspected captures

| Capture | Review |
| --- | --- |
| [Before game](before-game.png) / [After game](after-game.png) | Courier and crowd paths: evenly aligned pixel crosses become small alternating soles along each travel direction. The shared crowd trails remain subtle at game distance. |
| [Before close](before-close.png) / [After close](after-close.png) | Courier and foreground crowd trails: round heels and wider toe sections are readable; edges are soft, with a faint tread hint. The intersecting rows still read as separate steps. |
| [Corgi close](after-corgi.png) | Smaller pad with four toes, in an alternating trail behind the dog. The before combined captures contain the corgi but no corgi prints, since the previous emitter excluded companions. |

Reproduce final scenes using `SCENE_PORT=3424 npm run scene -- docs/reports/footprints/game.json docs/reports/footprints/close.json docs/reports/footprints/corgi.json --out test-results/footprints/final`. The fixtures use real game actors and locomotion. Browser automation was headless WebGL2/Metal through the shared four-slot lock.

## Draw and instance budget

| Matched camera | Before scene draws p50 / peak | After scene draws p50 / peak | Before/after shadow draws p50 / peak |
| --- | --- | --- | --- |
| Game | 53 / 55 | 53 / 55 | 52 / 52 |
| Close | 51 / 53 | 51 / 53 | 51 / 53 |

[Recorded counters](perf.json): footprint draws **0 → 0**, footprint instances **0 → 0**, retained track cap **1,024 → 1,024**. The existing system is a ground-material field, so it needs no separate instanced draw. No new asset downloads or dependencies. Frame-time parity is not established on the heavily loaded shared Mac; the broader L5 low-tier timing gate failed.

## Validation and outstanding gates

- Final typecheck, lint and production build pass.
- Footprint mask + full weather simulation: **18/18 pass**, including stride, mirroring, four toes, expiry, non-repetition, airborne/teleport rejection and bridge/barrier support.
- Final unit run: **814 pass, 4 fail**; static-check test separately passes. The four stale clinic-annex/police-station LOD static-bake byte mismatches also fail with the original HEAD weather source restored, confirming baseline failures. No generated assets were changed.
- Smoke: **6 sim pass; 25/26 browser pass**. L5 save/continue expects bat/kick/fists but receives fire-axe/bat; this is outside the footprint change.
- `verify -- E28`: **22 sim pass; 47/51 browser pass**. Failures: the same save rack expectation, a transient crowd asset 404 (isolated rerun passes after the final build), scripted-blackout brightness assertion, and the L5 low-tier frame-time budget. The roof/car accumulation and growing-track visual check passes, along with weather graph and storm precipitation budget checks.

The requested all-green unit/smoke/epic gates remain blocked by these failures. Nothing was deployed or merged; specs and reference assets were untouched.
