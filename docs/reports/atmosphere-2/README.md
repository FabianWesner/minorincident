# Atmosphere 2: bolder per-level mood

Lane `atmosphere-2` (Opus), branch `lane/atmosphere-2` from `lane/vfx-stunning-3` (`d80f5ef0d`). Round 1 (`docs/reports/atmosphere/`) was technically sound, but the levels still looked alike. This round makes the mood readable at a glance from the game camera. Everything is render-only: no sim or gameplay change, and the vfx-stunning-3 heat-haze pass is untouched. The grade sits next to the haze in the same composite.

## What changed

| Piece | Where | Cost |
| --- | --- | --- |
| **Per-level grade**: luminance-preserving split toning (shadow tint to highlight tint), hue-preserving contrast and saturation. Near-white paint rolls back to neutral. Strongly saturated or HDR pixels (courier red/teal, infected eyes, lamps) keep most of their colour. Bloom is added after the grade. | `PostFx.grade()`, inside the existing composite | No pass, no texture. About 25 ALU per pixel, both tiers. `gradeAmount 0` is a pass-through. |
| **Camera-relative low haze**: starts at 1.25× and ends at 2× the camera distance, so the courier and its 2 m ring never haze. It is thickest near the ground, so roofs stand out. Emissive surfaces skip it. | `PaletteMaterial` (non-emissive branch); `Lighting.hazeNear/Far` follow `view.radius` | ALU only |
| **Drifting cloud shadows** on day levels (L1–L4): two crossed sines in world space join the sun-shadow term, so patches take the authored shadow tint and move with the render clock. | `PaletteMaterial` | ALU only. 0 at night. |
| **Lamp beam weight** per level (`beamStrength`, 2–2.6 on night levels) | `PracticalEffects` beam opacity uniform | Existing draw |
| **Ambient life readable at zoom 1**: motes 5–8 cm and leaves 6–12 cm (round 1: 1.8 cm, invisible at zoom 1). `glow` lifts dust into HDR so it catches bloom. `rise` makes embers climb. New night fields: L5 ash flakes + sparks, L6 subway motes, L6/L7 embers, L8 fireflies, L9 wind debris, L10 cyan motes. | `AmbientLife`, `timeOfDay.ambient` | +0–2 draws, ≤ 94 triangles per view; low keeps the 30-triangle cap per field |
| Look keys (neutral defaults, validated ranges, lookdev panel) | `worldLook`, `lookPatch`, `Debug` | — |

## Per-level mood (my call, against the specs)

| Level (preset) | Mood | Why |
| --- | --- | --- |
| L1 (`L1`) | Warm golden morning: amber highlights, cool lilac shadows, peach haze, soft cloud shadows, golden motes | E19 "normal morning"; the clean start the rest of the campaign departs from |
| L2 (`L2`) | Crisp midday: near-white highlights, blue shadows, stronger contrast, the largest cloud patches, light blue haze | E20 §5.8: harder white light, bluer sky than L1 |
| L3 (`L3`) | Smoky hot late afternoon: amber highlights, mauve shadows, desaturated (0.78), high contrast (1.2), the thickest amber-brown haze, faster smoke shadows, rising ash | E21 §5.9: harsher contrast, warmer smoke haze, ash |
| L4 (`L4`) | Clean, saturated late afternoon ("false safety"): warm sun, cool-blue shadows, saturation 1.2, almost no haze | E22 §5.8: clear air, less haze than L3. The brief's "smoke-orange collapse" comes from the existing smoke columns; the preset itself must stay clear. |
| L5 (`L5`) | Grey ash sunset: orange highlights over grey-violet shadows, saturation 0.55, grey haze, drifting ash flakes and a few sparks | E23 sunset + PO "increasingly gloomy"; the ash greys out the red murk round 1 left |
| L6 subway (`L6-subway`) | Sodium-lit tunnel: orange-sodium pools against teal-grey concrete, dark tunnel haze, stronger beams, dust motes | E24 underground, warm practicals |
| L6 exit / L7 (`L6`) | Burning ruins at night: ember-red haze rising towards the top of the frame (the burning skyline), smoky mauve shadows, rising HDR embers | E29 "burning skyline". One shared preset keeps the L6 to L7 handover continuous. |
| L8 (`L8-zoo`) | Green-humid zoo night: teal shadows, warm lamp highlights, green ground mist (haze height 4 m), fireflies, strong lamp beams | E30 powered warm practicals and cool moonlight; humid zoo |
| L9 (`L9-crossing`) | Cold steel late night: blue shadows, pale moon highlights, desaturated (0.75), wind debris | E31 §5.6: late-night cool moonlight, **no forced dawn** (the spec forbids the brief's "cold dawn") |
| L10 (`L10-night`) | Violet-cyan lab night: violet shadows, cyan highlights, cyan motes | E32; separated from L9 by hue |

L9 and L10 carry **no haze**. Any haze over the verges cut the night-read road contrast from 2.7 to 2.0–2.4 (the first matrix had 18/126 failures at 0.3 haze and 8/54 at 0.12). With grade only, the values are back to 2.7.

## Evidence: sheets I opened

One page per level: before | after, row 1 high zoom 1, row 2 low zoom 0.5. Real seed-1 campaign starts, game follow rig, at 960×540. Before = `d80f5ef0d` build.

- WebGL2: `sheets/webgl2/L1.jpg` … `L10.jpg`. Overviews: `sheets/overview-webgl2-high-z1-L1-L5.jpg`, `sheets/overview-webgl2-high-z1-L6-L10.jpg`.
- WebGPU: `sheets/webgpu/L1.jpg` … `L10.jpg` (high zoom 1 + low zoom 0.5).

What I see in them:
- **L1** (opened): the café corner turns golden. The sidewalk is bright amber, shadows are lilac, a large soft cloud shadow crosses the road and golden motes are visible at zoom 1. The courier's red/teal and the corgi are clear at zoom 0.5 low.
- **L2** (WebGPU opened): cooler and crisper than L1. Whites stay white, and two soft cloud patches lie on the lawn and the road; firefighters inside a patch stay readable.
- **L3** (opened): salmon-amber sidewalks, a hazier top of frame, darker contrasty road, rising ash. The courier and the axe read well. It is the warmest and smokiest day level; the sidewalk salmon is strong.
- **L4** (WebGPU opened): warm sun on the bus roof and orange-tinted zebra stripes, cool-blue shadow side. At low zoom 0.5 the bus side reads blue-violet, so I softened the L4 shadow tint afterwards (`b14aa44fe`). **The sheets show the version before that softening** (see Unmeasured).
- **L5** (opened): clearly greyer than before; ash flakes over the ruins, with the courier and corgi in the warm pool.
- **L6** (opened): orange sodium pool on the supply crate, teal-grey tunnel, embers of light. The corgi is still dark outside the pool, as before (known, unchanged).
- **L7** (opened): the deep-violet night becomes ember-red haze at the top of the frame, with orange embers drifting over the crowd. Health bars, survivors and the courier read as before.
- **L8** (opened): teal-green humid night with yellow-green fireflies. The courier and corgi are readable, and the lamp path stays warm.
- **L9** (opened): olive-green night becomes cold steel-blue. The pale road band and the APC headlights remain clear.
- **L10** (opened): brown-dark becomes violet, with cyan motes. The road reads as a violet band; the courier ring and marker are clear.
- WebGPU sheets match WebGL2 frame for frame (L2, L4, L6–L10 overviews opened).
- Scene Lab sheets opened: `matrix/webgpu/atmosphere2-clouds-l2@high-z1/sheet.jpg` (cloud patches drift between f0 and f90; the courier and the infected inside a patch stay readable; no stipple), and `matrix/webgl2/atmosphere2-embers-l7@low-z0.5/sheet.jpg` (warm grade on the courier. Scene Lab has no district AmbientLife, so the embers are reviewed in the campaign stills).

## Gates

| Check | Result |
| --- | --- |
| Scene Lab matrix `atmosphere*,night-read-*`, high+low × zoom 0.5/1/1.5 | **WebGL2 126/126, WebGPU 126/126** ([GL](matrix/webgl2/index.md), [GPU](matrix/webgpu/index.md)). Includes the two new scenes `atmosphere2-clouds-l2` and `atmosphere2-embers-l7`. Night-read gates: typical ≥ 2.5, floor ≥ 2.0. L9 road 2.7/2.7. |
| Playwright (Mac, 1 worker): `e25-lighting`, `weather` (E28-AC12 moods, all kinds × both backends × both tiers), `l3-contrast`, `l7-night`, `smoke` | **41 passed, 2 failed**. The two failures are T-E29-14 L7 courier contrast high/low (2.087 / 2.162 vs ≥ 3). They are **pre-existing**: the identical values (2.077 / 2.160) appear with the unchanged `d80f5ef0d` build, and with the L6 grade disabled. |
| E25-AC13 night-street | Courier contrast 3.159 (high) / 3.346–3.348 (low) on WebGL and WebGPU; brightest-eye red margins 106–110 (≥ 60). |
| WebGPU shader | The first grade used chained channel swizzles of the sampled colour, which failed WebGPU/Metal pipeline creation (Tint: "swizzle view instruction still has usages after lowering", 16 WebGPU spec failures). Channels now come from dot products. Bisected and confirmed: the original fails, the fix passes. |
| Unit | `tests/unit/render/atmosphere.test.ts` 7/7 locally (neutral defaults, validation, per-level distinct grades, clouds by day only, haze beyond the focus, beam weight). Typecheck and lint pass. |
| Hetzner unit+levels+sim, first run (before the WebGPU/haze fixes) | 3145 passed / 4 failed / 11 skipped. All 4 are `timing` sim p95 cases (director 200 chasers, L10 assault, campaign NPC high, crossing horde). The sim is not touched by this lane. Final-tree rerun: see Unmeasured. |

## Cost (E18)

- Campaign counters ([counters.json](counters.json), 50 paired stills, both backends): +0–2 draws, ≤ +94 triangles. Maximum high 217 draws / 709k triangles; low 201 / 293k. All within the 600/1.5M and 300/500k caps.
- Native timing, `tools/perf/quiet-run.sh` (one reservation, ~3 min, real Chrome/Metal):
  - T-E18-09 horde 200, WebGL2 high: p50 4.6 ms / **p95 6.0 ms** (≤ 16.7).
  - L8 mixed outbreak frame p95: high **12.0 ms** (≤ 16.7), low **7.6 ms** (≤ 33.3), phone (390×844, 4× CPU throttle) **31.0 ms** (≤ 33.3).
  - Phone **simP95 7.4 ms > 6** fails; the sim is untouched by this lane. The baseline-build rerun for comparison is not yet done (see Unmeasured).
- Low tier: no heat-haze fetch (vfx-stunning-3), capped ambient fields, no lamp insects. Grade, haze and clouds are a handful of ALU on both tiers. I tried a separate low-tier grade variant and dropped it: it was not cheaper than one `pow`.

## Unmeasured / left

- **L4 after the softer shadow tint (`b14aa44fe`)**: not yet recaptured, and not yet rerun on `atmosphere-l4` in the matrix. Browser runs were paused because merge-batch11 needed both slots for the deploy gate. Data-only change (two values).
- **Baseline perf comparison** (same two specs on the `d80f5ef0d` build): not run yet, same reason. This includes the phone sim 7.4 ms question.
- **Hetzner suite on the final tree**: queued/running at the time of writing.
- Cloud drift and ember motion were judged from Scene Lab frame sequences and single stills; there is no video.
- Pre-existing and unchanged: L7 T-E29-14 courier contrast below 3, and the dark L6 corgi outside the lamp pool.

## Reproduce

```sh
npm run build
SCENE_PORT=3632 SCENE_SERVER=preview ATMOSPHERE_OUT=test-results/atmo2 ATMOSPHERE_ZOOMS=0.5,1 E2E_UNITS=1 \
  sh tools/e2e-lock.sh npx tsx tools/atmosphere/capture.ts after webgl2   # before: add SCENE_DIST=<baseline dist>
python3 tools/atmosphere/sheets2.py webgl2 webgpu
SCENE_PORT=3632 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'atmosphere*,night-read-*' --out docs/reports/atmosphere-2/matrix/webgl2
```

`capture.ts` now also takes `ATMOSPHERE_TIERS`, `ATMOSPHERE_LEVELS` and `ATMOSPHERE_LOOK` (a live look patch per level, `{"L2":{"cloudShadow":1}}`) for tuning without a rebuild.
