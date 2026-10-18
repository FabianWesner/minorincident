# VFX stunning, round 2 (lane vfx-stunning-2, Opus)

Branch `lane/vfx-stunning-2`, built on `lane/vfx-stunning` (b0bda6996). Baseline for every comparison is main `fcf81b4` (Sol's immutable pre-change build `/tmp/minor-incident-vfx-stunning-before`). No deploy, no merge.

## What changed

The orchestrator's verdict on round 1 was right: the blast was still one lumpy orange blob. Two things caused it. The E15 base burst drew **64 flat orange discs of 1.5 m** right on top of the E27 fireball. The E27 spheres also stayed hot and centred until they eroded. A third bug hid the smoke: MeshBasic smoke albedo of 0.17 linear comes out at about 0.45 sRGB, and the practical light field was *added* on top, so "dark" smoke rendered pale beige.

**Explosion (barrel/propane/car/grenade/bloated, all through `Blasts` + `Vfx.effect('explosion')`):**
1. **White-hot onset.** A shattering white core sphere (fireball kind 2, 0.12 s), a 0.12 s wide light pulse in the E25 light field (it lights nearby ground and walls), and a short hot ground pool. All three scale with the preset `flash`, so a Molotov gets only a small core. Flash reduction skips the core and the light pulse.
2. **Fireball breaks up.** Lobes start near the centre and drift outward on an ease-out, so they split into separate tongues. They cool from yellow to red and erode with noise.
3. **Dark soot billows** (fireball kind 1). There are 12 high / 4 low for a medium blast. They roll out just behind the fire, stagger upward into a column, and are sun-shaded. The fire lights them orange from below. The field light now multiplies the dark albedo instead of being added. Hot pockets glow in the first moments, then the billows erode from the silhouette inward and shrink. They dither in the player see-through hole like other occluders.
4. **Debris chunks.** A new pool of 64 flat-shaded scrap/rubble pieces, one draw. Their ballistic arcs and tumble are analytic in TSL (no physics bodies). A third of them glow hot for about 1 s, and they settle and shrink out within 4–6 s. There are none for Molotov or toxic.
5. **Shock.** A fast bright pressure ring (0.24 s) ahead of the E15 dust ring. The pressure ring has a stronger leading edge, and the dust ring has 1.6× the particles on high (½ instead of ⅓ on low). The old 64 orange discs are replaced by 2–4 core lobes plus 1–3 soot billows (`Blasts.core`, shared by blasts that have no E27 preset), plus 24 hot sparks.
6. **Lingering column.** Blast column puffs are darker (shade 0.17 → 0.085). Dark puffs take field light in proportion to their shade. The existing scorch decal and the distance-scaled shake/roll are kept.

**Gunfire:** a hot muzzle tongue streak and a shared muzzle light. The light is a 70 ms ground pool, at most every 50 ms, plus an E25 light-field transient at dusk/night on high only. Impacts now differ by surface:
- metal/vehicle: a glint star plus a fan of 6 sparks;
- stone/ground: a dust puff, 2 dark chips, 2 sparks and a glint;
- flesh: a short dark-red mist (grey with gore Off, amber when colourblind), under the existing blood spray.

The tracer gets a warmer colour; its length and width stay pinned by `tracers.test.ts`.

**Fire:** two buoyant embers per fire tick on high (one at 2 Hz on low), spread over the fire radius and drifting with the wind. I did not change the flame cards; their noise flicker was already good.

**Gore:** unchanged policy (Full/Reduced/Off). The only gore-related addition is the flesh mist.

**Cold first blast (orchestrator note):** non-level scenarios (blast-stress, Scene Lab) compile with a plain `compileAsync`. The VFX pools are invisible until the first effect, so that compile skipped them, and the first blast linked their WebGL programs in play. `GameView` now runs `vfx.prewarm()` around that compile (in the PostFx HDR context). Levels already prewarm through the full warm-up path; `Blasts.prewarm` now also covers the debris and the new fireball attribute.

Files: `src/render/vfx/Blasts.ts`, `Vfx.ts`, `FxPool.ts` (pressure ring mask only), `src/render/GameView.ts` (the prewarm hook above). I did not touch PostFx, Lighting, lighting/ or WeatherView. Scene changes:
- `vfx-explosion` now runs 240 frames.
- `vfx-vehicle-crash` now runs 300 frames. Round 1's 150-frame scene ended before the 180-tick wreck fuse, so it **never showed the car blast**.

`tools/scenelab/vfx-stunning.ts` gained `VFX_TIERS`, `VFX_ZOOMS` and `VFX_OUT`. `tools/scenelab/vfx-stunning-2-sheets.py` builds the sheets and the cost table.

## Sheets I opened (before | after, game camera, rows high/low × zoom 1.5/1/0.5)

| Sheet | What I see |
| --- | --- |
| [explosion WebGL2](sheets/explosion-webgl2.jpg), [WebGPU](sheets/explosion-webgpu.jpg) | **Before:** one solid orange/yellow blob at f50, and a pale beige cloud over the fire at f110. **After:** f20 has a white-hot core with spark streaks and a bright pressure ring. At f50 the fire has split into separate orange tongues with dark soot billows rising through them, and debris specks are flying. At f110 a dark eroding soot column sits above the fire and debris lies on the ground. Low keeps the same read with fewer lobes and billows. At zoom 0.5 the fireball fills the frame in both builds. The two backends look identical. |
| [vehicle-crash WebGL2](sheets/vehicle-crash-webgl2.jpg), [WebGPU](sheets/vehicle-crash-webgpu.jpg) | f192 (blast onset): a localized white core with the wreck still visible at zoom 1–1.5. At zoom 0.5 the core covers about half the frame. An earlier iteration whited out the whole screen; I shrank the core, pulse and glow. f216: the fireball is broken up by dark soot, and panels and chunks are flying. f288: a dark smoke column over the burning wreck; before, it was pale grey. |
| [molotov WebGL2](sheets/molotov-fire-webgl2.jpg), [WebGPU](sheets/molotov-fire-webgpu.jpg) | Night. f24: the small core with sparks and the ring, no whiteout. f72: black petrol smoke rolls up over the flames, where before it was a soft grey haze. f168: the steady flame cards with the smoke column; embers are faint at this size. |
| [rifle WebGL2](sheets/rifle-impact-webgl2.jpg), [WebGPU](sheets/rifle-impact-webgpu.jpg) | A warm muzzle pool on the ground under the gun is the most visible change, plus a hot streak at the muzzle. Tracers are about the same. The flesh mist on the Alpha is barely visible at zoom 1–1.5 behind its white hit flash; the blood spray carries that read. **Honest:** gunfire is a modest improvement, not "stunning". |

All 96 runs (4 scenes × 2 backends × 2 tiers × 3 zooms × before/after) passed their gates, with 0 console errors. The 12 low-tier explosion/vehicle runs were re-run after the last commit and passed.

## Cost (Scene Lab zoom 1; [table](costs.md), [all rows](scene-costs.json))

CPU p95 (sim + submission) is unchanged within noise, 1.3–3.3 ms. Draws are +1 (the debris pool) while chunks are alive.
- Triangles: +26k on high from 96 fireball slots (dead slots are zero-sized), +5.4k on low (56 slots).
- **Cold first blast, Scene Lab, first scene in session, WebGL2:**
  - high: main 49 ms → 2.2 ms;
  - low: main 46 ms → 2.5 ms;
  - for reference, before the prewarm hook my branch measured 257 / 530 ms.
- WebGPU cold blast: 24.5 → 25.7 ms (high), 21 → 32 ms (low). The prewarm hook is WebGL-only, matching the existing condition.
- **blast-stress perf spec** (`tests/perf/explosions.spec.ts`, real Chrome/Metal, non-quiet Mac, load ~3.4, 2 runs). The max frame is at ~2.1 s, the known corpse-page bake beat.

| Tier | Frame p95 | Max frame | Main max (orchestrator) |
| --- | --- | --- | --- |
| High | 7.3–7.5 ms | 165–169 ms | 180.8 ms |
| Low | 12.1–13.2 ms | 78–102 ms (noisy) | 79.1 ms |

## Validation

- `npm run typecheck`, `npm run lint`: pass.
- Local VFX/E27 units (13 files, 51 tests): pass.
- `tests/e2e/explosions.spec.ts`: **6/6 pass** after the final commit. T-E27-03 failed during the work: Sol's feathered pressure ring made the ring detector read 485 against 489 needed (main itself passes by only 4 px). The stronger leading edge fixed it (488 > 486). I changed no assertions.
- `tests/e2e/vfx.spec.ts`: 7/8. `T-E15-lifecycle` expects 2 textures and sees 5. It is the same failure Sol reproduced on the main baseline.
- Remote full unit (an earlier commit): 281/284 files pass. The 2 failures are unrelated to VFX and do not touch files I edited: `traceability.test.ts` (E29-AC01 tag) and `tooling/l7-runner-default.test.ts`. Final-head remote result: see the commit note.

## Unmeasured / open

- No quiet-window native E18 run; the perf numbers above come from a busy Mac. Heat-distortion shockwave: not done, since it needs a PostFx pass; deferred.
- Gunfire impacts and flesh mist are subtle at zoom 1. Embers at night are faint.
- At zoom 0.5 the car blast's white core still covers about half the frame for ~2 frames. Tune `punch` in `Blasts.play` if the PO finds it too much.
- Soot billows are opaque, eroding meshes, a stylized choice. Their late erosion leaves a slightly "cut-paper" edge for about 0.3 s.
