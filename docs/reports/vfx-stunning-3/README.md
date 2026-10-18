# VFX stunning, round 3 (lane vfx-stunning-3, Opus)

Branch `lane/vfx-stunning-3`, built on main `c31833b` (batch 10). Every before/after comparison uses an immutable build of `c31833b`. No deploy, no merge.

## What changed, by orchestrator verdict

1. **Pale smoke column → dark, rising, wind-bent plume.** Blast columns are a new `plume` kind:
   - shade 0.085 → 0.05;
   - buoyant puffs: 2.6–4 m/s up, 8–11 s life, swelling to 1.2–1.7× the preset size;
   - up to 2.5 puffs per emission in the first seconds, easing to 1 by 4 s. Births keep the cohort spacing, so T-E27-03p still holds.
   - Dark puffs stay dense for most of their life and fade late. Wind drift grows with age (bend 0.2 → 1.7× per second of age).
   - Fire and car smoke are darker: 0.2 → 0.12 and 0.14 → 0.07.
   - Practical (fire) light now scales with smoke albedo: field × min(1.4·shade, 1), was min(2.5·shade, 1). The orange underglow now hugs the flames (below 3 m) and is capped at 0.45. Before, the column above the fire turned peach.
   - The E15 base blast smoke burst changed from pale lavender `0x685866` to soot `0x3a3234`.
2. **Gunfire punch** (tracer length/width untouched, `tracers.test.ts` and the 7/2 contact-slot budgets unchanged):
   - Muzzle: a bigger star (0.65 → 1.05 m) set slightly ahead of the barrel, plus (high only) a white-hot 0.45 m centre star. The tongue is longer and faster (26 → 30 m/s, trail 0.75 → 1.05). The muzzle ground pool is wider and brighter.
   - Tracer: the ribbon is now HDR (×2.6) with a white-hot centre line, so bloom gives it punch at the pinned geometry.
   - Impacts use the same slots, but every element is larger: dust 0.36 → 0.5 m, chips, faster/longer sparks, star 0.32/0.5 → 0.5/0.75 m. Metal also gets a short glint pool on the ground. The flesh mist is larger.
3. **Heat haze (new, high tier only).** `PostFx` samples the scene colour at a rippled UV inside up to 8 screen discs (`PostFx.heat`, `HEAT_SOURCES`). Each source costs one disc mask; one shared two-sine ripple is evaluated per pixel at the mask-weighted source scale. Bloom keeps reading the undistorted scene.
   - Sources (`Blasts.heatSources()`): every blast for 2.2 s, as a rising, growing, fading disc, plus visible fires. `GameView.updateHeatHaze` projects them each frame.
   - The low tier builds no haze node at all.
   - It is the same TSL graph on WebGL2 and WebGPU. I checked the UV origin with a temporary red-tint build of an off-centre blast: the mask sat on the fire on both backends (three's post quad has a top-left UV origin on both).
4. **White core no longer wipes the screen at zoom 0.5:**
   - Core sphere: size (0.2 + 0.3·punch) → (0.13 + 0.17·punch) × fireball size; life 0.12 → 0.09 s.
   - Light-field pulse: 7 → 6·punch, range 0.7 → 0.5.
   - White ground pool: r·1.8 (max 9 m) → r·0.8 (max 4 m).
   - Coloured blast pool: r·2.2 at up to 2.2 → r·1.4 at up to 1.3.
   - Fire lobes: white only in hot pockets (gradient top 0.7–1 → 0.86–1.15, HDR boost 2.6 → 2.2).
5. **WebGPU cold compile.** Batch 10's merge (`6265c973a`) already sends every scene with VFX through the full warm-up on both backends. Round 2's WebGL-only branch was left as dead code. I removed it, so there is now a single warm-up path. Measured below with a pipeline/program/node-build hook (`FIRST_BLAST_DIAG=1`): **0 programs, 0 pipelines, 0 node builds > 1 ms after the first blast**, on WebGL2 and WebGPU, high and low, main and branch. Note: the haze graph is part of the always-on PostFx, so it compiles at load.
6. **Low-tier max frame.** See the table: low is at or below main within noise.

Files: `src/render/vfx/Blasts.ts`, `Vfx.ts`, `FxPool.ts` (tracer shading only), `src/render/PostFx.ts` (haze pass), `src/render/GameView.ts` (haze feed, warm-up cleanup). New: `tests/scenes/catalog/vfx-smoke-column.json` (in the `scene:matrix` `vfx-*` filter), `tests/perf/first-blast.spec.ts`, `tools/scenelab/vfx-stunning-3-sheets.py`.

## Sheets I opened (BEFORE main c31833b | AFTER; rows high/low × zoom 1.5/1/0.5)

The four best:

| Sheet | What I see |
| --- | --- |
| [smoke-column WebGL2](sheets/smoke-column-webgl2.jpg) | **Before:** pale grey-white round puffs over the fires at f270/f510, and peach blobs at zoom 0.5. **After:** a charcoal column rises off the top of the frame at zoom 1.5/1 on both tiers and leans slightly downwind. At high zoom 0.5 the puffs right above the flames are still lit warm (fire light), but much less than before. On low at zoom 0.5 they are mostly gone. |
| [vehicle-crash WebGPU](sheets/vehicle-crash-webgpu.jpg) | f192 (car blast onset) at zoom 0.5: **before**, a white wipe over about two thirds of the frame; **after**, the wreck stays visible inside a smaller white ring. f216: the fireball fills the zoom-0.5 frame in orange on both builds; that is the 2.8 m fireball size, not white. f288: a darker column at zoom 1/1.5. |
| [explosion WebGL2](sheets/explosion-webgl2.jpg) | f20: the fireball is more orange/yellow with white pockets instead of a bright cream ball, most visible at zoom 0.5. f110: the soot over the fire is dark grey (before: pale cream-grey). |
| [rifle-impact WebGL2](sheets/rifle-impact-webgl2.jpg) | Zoom 0.5: a clearly larger, brighter four-point muzzle star and a hotter, whiter tracer streak, on both tiers. At zoom 1–1.5 the gain is visible but still small. The Alpha's white hit flash still dominates the flesh hit. |

The other sheets are in `sheets/`: explosion, molotov, rifle, smoke-column and vehicle-crash, each for WebGL2 and WebGPU. The WebGPU and WebGL2 sheets look the same. **Heat haze cannot be judged from stills**: the sheets show no artefacts, and placement was checked with the debug tint described above.

All 120 runs passed their gates, with 0 console errors: 5 scenes × 2 backends × 2 tiers × 3 zooms × before/after.

## Cost

Scene Lab ([costs.md](costs.md), CPU stepMs, zoom 1): p95 is unchanged within noise. Draws and triangles are identical, because the effects reuse existing pools and the haze sits inside the existing post pass. The Scene Lab cold blast is now 2.2–2.6 ms on both backends, and main matches since batch 10.

**First-blast frame times** (`tests/perf/first-blast.spec.ts`, real Chrome/Metal, `quiet-run`, blast-stress car chain plus fuel truck and 30 infected; low = 390×844 at 4× CPU throttle). The table gives `firstMax` (max frame in the first 1.5 s after the first blast) per run:

| Backend / tier | main c31833b | branch |
| --- | --- | --- |
| WebGL2 high | 11.8, 15.4 | 10.4, 11.5 |
| WebGL2 low | 25.8, 28.0 | 25.4, 29.8 |
| WebGPU high | 39.6, 20.7, 20.5, 21.5, 21.3 (median 21.3) | 20.5, 21.8, 21.3, 37.8, 20.7 (median 21.3) |
| WebGPU low | 29.3, 26.2, 25.7, 25.2, 28.4 (median 26.2) | 30.9, 26.9, 35.0, 28.7, 26.2 (median 28.7) |

- The ~38 ms WebGPU-high outliers are not compiles: the diagnostic hook shows no builds after the blast. They belong to a periodic ~38 ms frame every ~110 ms that headless uncapped WebGPU at 1600×900 shows on both builds (GPU queue back-pressure).
- WebGPU low median is about 2 ms over main. That is within run-to-run spread, and the low tier has no haze; the extra plume puffs are the only low-tier cost.
- The only builds during the run happen 3 s before the blast, when the car turns into a wreck: `pal_sidewalk` / `pal_static-colors`, 8–14 ms node builds on low. They are outside VFX scope.

**E27 perf spec** (`tests/perf/explosions.spec.ts`, WebGL2, whole 7 s window, one run each):

| Tier | main frameMax / p95 | branch frameMax / p95 |
| --- | --- | --- |
| High | 12.9 / 6.4 ms | 12.7 / 6.7 ms |
| Low | 43.1 / 12.7 ms | 30.5 / 13.8 ms |

Low is back under main. High is well under the 50 ms E18 hitch budget.

## Validation

- `npm run typecheck`, `npm run lint`: pass.
- Local VFX/E27/PostFx units (11 files, 45 tests): pass. That includes tracers, contact-slot budgets and T-E27-03p (I fitted the work to them; no assertion was changed).
- Remote full `tests/unit tests/levels tests/sim`: see the report line below.
- Browser: 120/120 Scene Lab runs; first-blast perf 28/28 runs pass; explosions.spec perf 4/4 pass.

## Open / unmeasured

- Gunfire is clearly stronger at zoom 0.5. At zoom 1 it is better but still not dramatic: the 7/2 contact-slot and particle budgets cap how much an impact can show.
- At zoom 0.5 the car fireball itself still fills the frame for about 10 frames (orange, not white). Shrinking the fireball would change the E27 read at zoom 1.
- Heat haze is judged only by the debug-tint placement check and artefact-free sheets, not in motion by a person. A short WebM review is worth doing.
- One run each for explosions.spec; the first-blast probe has 2–5 runs per cell.
