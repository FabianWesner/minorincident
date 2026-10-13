# L10-S5 — Mega distance audio and HUD

Scope: E32 §5.5, AC13/AC14 and the instrumental/subtitle portion of AC15. The complete campus, cure item and finale mission belong to their implementation lanes.

The persistent pursuit emits seeded roar/impact pairs every 20–35 seconds of simulation time. Moving footsteps sound below 60 m. Timers and sequence index live in the pursuit checkpoint snapshot. The presentation event exposes a band and source ID, with no position or bearing. Existing licensed sprite slices are pitched/filtered at runtime; close move telegraphs have priority 150. The ordinary infected vocal/cluster paths exclude Mega models.

The production minimap shows a pulsing player-centered band ring and accessible distance text. Mega models are excluded from ordinary infected pins and directional damage arrows, including authored models before pursuit attachment. Pulse is CSS only, with reduced-motion support; death removes the ring. Scene Lab's optional `megaHud` shows this same production HUD for the matrix.

The campus lane can use the existing mission action:

```ts
{ kind: 'radio', id: 'L10.research' }
```

It displays the full research explanation for 14 seconds even with audio/captions disabled. Audio plays a filtered existing instrumental excerpt on the dialogue bus, ducking the score without adding an actor. L10 reuses the licensed L6 calm/tension recordings and tempo, plus the shared combat/aftermath score. Existing `music.intensity` events accept the director's optional `minimum` and `complete` fields: use `minimum: .25` for delivery, `phase: 'boss'` for assault, and `complete: true` for release/resolution (emit the saved phase again on load).

All stock attribution remains in [the audio license ledger](../../../public/assets/audio/LICENSES.md). No audio bank grid, dependencies or game assets are regenerated.

## Validation and vision review

| Check | Result / evidence |
| --- | --- |
| Typecheck, lint, production build | PASS |
| Audio unit/sim integration | 40 PASS ([summary](audio-functional.json)); final movement/timer/terminal lane cases 7 PASS ([summary](lane-functional.json)) |
| Live desktop + phone audio/HUD | 8 PASS; final touch layout recheck 4 PASS |
| Scene matrix | [WebGL2 24/24](webgl2/index.md), [WebGPU 24/24](webgpu/index.md); high/low, zoom 1.5/1/0.5, 250/120/40/20 m |
| Native Metal, full 200/100 infected | 2 PASS; [high](perf-high.json) / [low](perf-low.json) |
| Full unit regression (Hetzner) | 1,331 PASS, 1 timeout, 7 skipped: existing `T-E17-02b` geometry contract validation reaches 300 s ([summary](unit.json)) |
| Full sim + tests/levels regression (Hetzner) | 1,141 PASS, 29 FAIL, 2 skipped ([failures](sim-levels.json)); these remain open integration results |
| Final E32 verify | PASS: 50/50 unit/sim ([summary](verify-sim.json)) and 39/39 browser checks (Chromium, mobile profiles and WebKit) |

Actual PCM WAV measurement of the production roar, same graph/mix and pitch, both tiers:

| Distance | Band | RMS dBFS | Increase |
| --- | --- | --- | --- |
| 250 m | distant | −38.44 | — |
| 120 m | approaching | −31.43 | +7.00 dB |
| 40 m | near | −24.39 | +7.04 dB |

[RMS high](rms-high.json), [RMS low](rms-low.json). Low-tier voice saturation admits the priority-150 close telegraph and its caption; voice counts stay inside 32/16.

Native headless Chrome/ANGLE Metal (Apple M4), twelve seconds with the full horde and live production audio:

| Metric | High | Low | E18 limit high / low |
| --- | --- | --- | --- |
| Frame p95 | 6.2 ms | 4.8 ms | 16.7 / 33.3 ms |
| Sim p95 | 1.6 ms | 1.1 ms | 4 / 6 ms |
| Draw calls peak | 64 | 43 | 600 / 300 |
| Triangles peak | 1,086,239 | 212,148 | 1.5M / 500k |
| Audio voices peak | 28 | 12 | 32 / 16 |
| Infected | 200 | 100 | 200 / 100 |
| Retained JS heap | 107.2 MB | 74.0 MB | 400 / 250 MB |

Memory uses the existing E18 method: collect garbage through CDP, then `Runtime.getHeapUsage`. Raw uncollected heap is retained in the test-results proof (666.0/398.0 MB); it includes temporary test/renderer allocations. The stress crowd uses the production spawn API so Scene Lab does not attach clipping/pose probes to every infected. These are focused fixture measurements; all-region residency cycles and physical phone performance remain the finale QA lanes.

Opened and inspected the desktop and touch captures at 250/120/40 m, plus the high/low sheets on both backends and both required zooms. At 250 m the wide outer golden ring reads “distant”; at 120 m it contracts and reads “approaching”; at 40 m it is the small inner ring labelled “near.” Every ring stays centered on the courier. The text is complete, above the map dots, clear of the weather badge and inside the 390 px touch viewport. The map's player arrow and checkpoint icon remain; there is no Mega dot or bearing, including the 20 m negative fixture. Death hides ring and text. Zoom 0.5 enlarges the courier while preserving the HUD size and band cue. UI review: F must items PASS, 8/10 for the touched presentation; labels are compact but readable. This isolated slab validates distance information, not campus/environment art.

- [250 m desktop](hud-high-z1-250.jpg), [120 m desktop](hud-high-z1-120.jpg), [40 m low/zoom 0.5](hud-low-z0.5-40.jpg)
- [250 m touch](phone-low-z0.5-250.jpg), [120 m touch](phone-low-z0.5-120.jpg), [40 m touch](phone-low-z0.5-40.jpg)

The first visual review caught the weather badge obscuring the label; placement was corrected and re-captured. The touch recheck caught a fixture missing the normal `full-ui` class; it now uses the production touch styles. The Scene Lab backend check had compared renderer `webgl` with CLI `webgl2`; it now normalizes the names while retaining the exact requested-backend gate. Budgets and specification criteria are unchanged.

Early busy-run E32 timing failed, and the same job reproduced 7.70 ms on baseline source ([baseline](baseline-moves-200.json)); a later idle final E32 run passes all 50 selected unit/sim tests. Historical busy audio timing is kept in `busy-run-sim-perf-*.json`. The full regression failures above remain explicit, without relaxing their assertions.

Reproduce the focused checks after a fresh `npm run build`:

```sh
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit/audio/mega-presentation.test.ts tests/sim/ai/mega-audio.test.ts --maxWorkers=1
E2E_PORT=3480 sh tools/e2e-lock.sh npx playwright test tests/e2e/audio/mega.spec.ts --project=chromium --workers=1
SCENE_PORT=3477 SCENE_SERVER=preview npm run scene:catalog -- --matrix --backend webgl2 --filter 'l10-mega-audio-*' --jobs 1
SCENE_PORT=3476 SCENE_SERVER=preview npm run scene:catalog -- --matrix --backend webgpu --filter 'l10-mega-audio-*' --jobs 1
E2E_PORT=3478 sh tools/perf/quiet-run.sh npx playwright test tests/perf/mega-audio.spec.ts --project=chromium --workers=1
E2E_PORT=3479 MI_VERIFY_REMOTE_SIM=1 npm run verify -- E32
```

