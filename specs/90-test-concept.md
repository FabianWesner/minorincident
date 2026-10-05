# 90 · Test Concept: How a Coding Agent Tests the Game

## 1. The problem

A coding agent cannot sit down and play. It can run commands, drive a headless browser, read JSON, and **look at screenshots**. So the game is built to be **testable by construction**:

1. **Deterministic**: a fixed 60 Hz sim, seeded RNG, and no wall-clock dependence, so the same inputs always give the same state.
2. **Headless**: the whole simulation (AI, combat, physics, missions, progression) runs in Node with no renderer.
3. **Observable**: a typed event log and JSON state snapshots expose everything that matters.
4. **Controllable**: the test API can load any level, checkpoint, scenario, or progression, and inject input, step time, or use cheats.
5. **Playable by bots**: scripted bot policies play through `InputFrame`s like a human would, so "is the level completable, how long does it take, is it too hard" become measurable.
6. **Visually reviewable**: fixed photo spots with deterministic cameras give pixel regression *and* structured AI-vision review against the concept art.

## 2. Test layers

| Layer | What it proves | Tooling | Runs in | Speed |
| --- | --- | --- | --- | --- |
| **L0 Static** | types, lint rules (no `Math.random` and no DOM in sim), import boundaries, data schemas, asset manifest, GLB validation (gltf-transform), deterministic Blender rebuilds, inventory sync, licenses | `tsc`, ESLint, custom validators | Node | seconds |
| **L1 Unit** | pure functions: damage math, offers, save migration, schema validation, spatial hash, steering math | Vitest | Node | seconds |
| **L2 Sim** | gameplay rules in scenarios; AI behavior; mission graphs; **bot playthroughs of whole levels**; balance metrics; determinism | Vitest + `tools/sim-runner` | Node (headless) | seconds to minutes (time-accelerated; no rendering) |
| **L3 Browser e2e** | device input wiring, UI flows, render-sync, asset loading, no console errors, full playthrough in the real app | `@playwright/test` (Chromium WebGL/SwiftShader; WebKit and mobile emulation for smoke) | headless browser | minutes |
| **L4 Visual regression** | the look did not change unintentionally | Playwright screenshots + pixelmatch against goldens | headless browser | minutes |
| **L5 Vision review** | the look is *right* (matches the concept art, readable, decay reads) | the agent reads screenshot + reference pairs and fills checklists (§7) | agent | per epic |
| **L5b Audio measurement** | the mix, acoustics, ducking, loudness, coverage (agents measure instead of listening) | `OfflineAudioContext` renders in the browser → WAV → Node analysis (LUFS, true peak, RT60, spectral centroid, pitch) | browser + Node | minutes |
| **L6 Performance** | budgets: draw calls, triangles, sim ms, memory, download size; frame time locally | `perf()` counters, sim-runner timing, Playwright network | Node / browser / local GPU | minutes |
| **L7 Human** | fun, feel, difficulty perception | playtest protocol (§11) | humans | per milestone |

The pyramid rule: **prove gameplay in L2** (fast, deterministic, exhaustive). Use L3 to prove the wiring and L4/L5 to prove the looks. Never test gameplay rules only through the browser.

## 3. Determinism and control

- **Seeds:** `loadLevel(id, { seed })` seeds every RNG stream. Tests always pass an explicit seed. Seed sets are fixed lists in `tests/fixtures/seeds.ts` (e.g. `SEEDS_20 = [1, 7, 42, …]`).
- **State hash:** `getState()` has a stable canonical JSON form. `stateHash` is FNV-1a over the gameplay-relevant subset (entities, transforms rounded to 1e-4, HP, mission, RNG cursors). Determinism tests compare hashes.
- **Time:** tests use `pause()` plus `step(n)` for exactness, or `setTimeScale(k)` for long browser runs. Render-only effects (hit-stop, camera smoothing) never feed back into the sim.
- **Input injection:**
  - `__SS__.input.set(frame)` injects **logical** input (used by sim-level tests and bots).
  - Device-level tests (E03, E14) use **real Playwright mouse, keyboard, and touch events** so the adapters are covered.
- **Recording:** `Recorder` saves `{seed, level, checkpoint, InputFrame[]}` as `.ssrec`. Any failing bot run writes a recording, which can be replayed in Node or in the browser to debug (`npm run sim -- --replay file.ssrec`).

## 4. Browser test environment

- Chromium from the Playwright version pinned in the lockfile, headless, `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- URL: `/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=<n>`. **WebGPU is not used in CI tests** (SwiftShader lacks reliable WebGPU support). A separate local, headed suite (`npm run test:e2e:webgpu`) checks WebGPU on a real GPU.
- Viewport 1600×900 (desktop), and for mobile the 390×844 / 844×390 projects with `hasTouch`, `isMobile`.
- Fonts are bundled locally (no network fonts in tests), UI CSS animations are disabled in test mode, and the cursor is hidden.
- **Focus and visibility tests** (E16-AC21, E14-AC11, E03-AC13): leaving the tab is simulated in three ways. (1) A second page plus `bringToFront()`, a real tab switch in the same context. (2) `page.evaluate` overriding `document.visibilityState`/`hidden`, then dispatching `visibilitychange`. (3) Dispatching `blur`/`focus` and `pagehide` on `window`. Each test reads `AudioContext.state`, the music playback position, the cue log, and `__SS__.tick()` before, during, and after.
- **Console guard:** every test attaches a listener and fails on `console.error`, `pageerror`, or a failed request for an asset, except for items in the allow-list.
- `await __SS__.ready` and `await __SS__.screenshotReady()` before any screenshot.

## 5. Bots

Bots live in `src/debug/bot/` and run in **both** Node and the browser. Each tick they read a **perception view** of the sim (an approximation of what a player sees: entities within the camera frustum + 5 m, objective markers, minimap data) and emit an `InputFrame`. Bots **never use cheats** in completion tests.

| Policy | Purpose | Behavior |
| --- | --- | --- |
| `complete` | "Is it completable?" | Follows the objective marker via the nav grid. Uses a threat-weighted utility for target choice; kites when HP < 40%; uses the best action per target (range bands); uses vehicles when the objective is more than 80 m away and a car is within 15 m; revives escorts; interacts with devices; **in prep phases fills the nearest barricade slots** (push the nearest props along the nav path into the slot, then brace) and repairs barricades between waves; kicks props at runners when a prop is within 2 m. |
| `newbie` | "Is it 5–10 min and fair for a newcomer?" | `complete` plus handicaps: 250 ms reaction delay, ±15° aim noise, 15% chance of using a suboptimal action, uses the selector only every 10 s or more, 0.8× path efficiency (it wanders to points of interest), ignores optional hazards, and uses aim assist at Default. |
| `evade-only` | "Can segments be survived without fighting?" (L1 seg. 2) | Never attacks; maximizes distance from threats along the objective direction. |
| `aggressive` | stress and balance upper bound | Charges the densest group; uses all charges immediately. |
| `idle` | "Does standing still kill you?" (difficulty floor), soak tests | No input. |
| `driver` | vehicle tests | Follows the course spline with pure-pursuit steering and stuck recovery. |

**Bot outputs** (per run JSON): outcome, sim time, deaths, damage taken and dealt by source, kills by archetype and weapon, objective timeline, escort downs, convoy HP, vehicle use, max concurrent infected, `simMsP95`, and a recording file on failure.

**Bot validity guard:** the bots themselves are tested. In the `bot-gym` scenarios (a known path, a known fight), `complete` must succeed and `idle` must fail. This proves a passing level is due to the level being completable, not a broken bot.

## 6. Scenarios and fixtures

`tests/fixtures/scenarios/*.ts` are small worlds for focused tests: `empty`, `lookdev`, `combat-arena`, `horde-arena`, `maze`, `civ-street`, `drive-course`, `mission-sandbox`, `vfx-stress`, `bot-gym-*`, `perf-horde-100/200`, `perf-l5-bridge`, `perf-l6-mainstreet`, `light-lab` (the light-tower trailer at night), `reflection-lab`, `night-street`, `prop-yard`, `barricade-lab`, `blast-lab`, `fire-lab`, `smoke-lab`, `gore-probe`, `turning-probe`, `audio-mix`, `animal-lab`, `weather-lab`, `storm-street`. Each declares its `seed`, entities, camera photo spots, and expected invariants.

**Progression presets** (`L2-default` … `L6-default`) let any level load with a realistic build, so later levels can be tested without replaying earlier ones.

## 7. Visual verification

### 7.0 Photo spots and goldens

- Each district, scenario, and level defines **photo spots**: a named, fixed camera with a fixed sim tick, seed, time of day, and optionally a frozen crowd. `__SS__.camera.preset(name)` plus `step(0)` plus `screenshotReady()` → screenshot.
- **Goldens:** `tests/visual/__goldens__/<spot>.png`, compared with pixelmatch (threshold 0.1, max differing pixels 1.5% by default; per-spot overrides). Goldens are updated only with `--update-snapshots` **and** a vision review of the new image saved next to it in `review.md`.
- **Comparison sheets:** `tools/compare.ts` builds a side-by-side PNG of the reference (draft crop) and the render (with a grid) for each review, saved in `test-results/epics/E<NN>/compare/`.
- **Frame sequences** for temporal effects (explosions, power-on flicker, light crossfades): capture at fixed sim ticks and run per-frame detectors (luminance spikes, hue-area growth, ring-radius growth).
- **Light and shadow probes:** the ID pass + a lights-off render of the same spot give the light contribution per pixel (on minus off), used by E25 metrics (pool ratios, shadow darkening).
- **Pixel metrics** for objective checks: hue and luminance histograms in masks, the coverage share of the object, mean luminance of the window-glow mask, contrast between the player mask and its surroundings (masks come from an ID render pass: `?test=1&idpass=1` renders entity-category colors).

### 7.1 Vision review protocol

The agent opens the render and the reference (or the comparison sheet) with its image-reading tool, answers each checklist item **PASS / FAIL with a one-sentence justification**, and records the result in `test-results/epics/E<NN>/review.md`. An overall pass needs every **[must]** item to pass and at least 70% of the **[should]** items. A FAIL creates a task in the epic report. Reviews are not self-graded leniently: if unsure, mark FAIL and explain.

**Checklist A: North-star / diorama look** (compare with the mockup or district sheet)
- [must] Warm, saturated palette; no gray or desaturated "default Three.js" look
- [must] Shadows are soft and tinted (purple-blue), not black
- [must] Emissives (windows, lamps, neon, sirens) glow with bloom
- [must] Camera angle and FOV feel like the mockup (high 3/4, little perspective distortion)
- [should] Chunky toy-like proportions; slight bevels; no razor-thin geometry
- [should] Foliage dense and rounded, with flowers adding color accents
- [should] Composition: player readable at about 1/12 of the screen height; no UI overlap with the action
- [should] Comparable density of props and clutter to the reference

**Checklist B: Character** (compare with the S01/S02/S03 turnaround)
- [must] Silhouette recognizable as the reference character from 4 views
- [must] Identity colors correct (e.g. red top, teal backpack, red sneakers; infected red eyes)
- [must] Proportions within ±10% of reference head-to-body ratio
- [should] Key accessories present (hard hat, visor, shield, apron, etc.)
- [should] Face reads at gameplay distance (eyes, mouth)

**Checklist C: Asset turntable** (the GLB rendered in the game renderer; compare with `assets/<id>/reference-upscaled.png`)
- [must] Recognizable at a gameplay-camera distance
- [must] Main part layout matches (e.g. axle spacing, door count, signage area)
- [must] Material separation correct (paint / chrome / glass / rubber etc.)
- [should] Hidden sides plausibly inferred and consistent with the style
- [should] Within the triangle budget without visible faceting at gameplay distance
- [must] No real-world brand names, logos or trademarks (decision R2); infected and civilian characters read as adults or older teens (decision R1)

**Checklist D: Readability in combat**
- [must] The player is identifiable within 1 second of looking (contrast, outline or colors)
- [must] Infected are separable from the background; glowing eyes visible
- [must] Attack telegraphs are visible and distinguishable by shape
- [should] Pickups and interactables are distinguishable from clutter
- [should] VFX don't hide the player or telegraphs for more than brief moments

**Checklist E: Decay reads** (same spot at a lower and a higher tier)
- [must] It is obviously the same place (layout, landmarks)
- [must] The higher tier is obviously worse (destruction, fire, darkness, mess) matching its tier description (`01` §5)
- [should] The decay is varied (not one prop repeated everywhere)
- [should] The lighting mood matches the time of day for the level

**Checklist F: HUD** (compare with the mockup)
- [must] Portrait + health bar top left; minimap top right; slot cards bottom center
- [must] The selected side is clearly indicated
- [must] Text legible at 1600×900 and 390×844
- [should] The style matches the mockup (rounded dark panels, chunky bars, key badges)

**Checklist G: Lighting** (compare with the lighting key frames in `assets/_keyframes/lighting/`)
- [must] Light sources glow (HDR emissive + bloom) and **cast visible light** on the ground and nearby surfaces (pools, spill)
- [must] Light respects geometry: pools stop at walls; hero lights cast shadows from characters and props
- [must] Shadows are colored and soft or sharp appropriately (sun soft, spots crisper); no black shadows
- [must] At night the player and the threats remain readable; darkness is moody, not muddy
- [should] Volumetric beams, lit haze, and glints add atmosphere without washing out the image
- [should] Reflections appear where the surface demands them (wet asphalt streaks, car paint, glass, polished floors)
- [should] The mood matches the level's light script (`06` §2)

**Checklist H: Explosions, fire and smoke**
- [must] The blast reads in stages: flash → fireball → shockwave → debris → smoke (frame sequence)
- [must] Physical consequence is visible: props, corpses, and cars move or fly; the scorch remains
- [must] The fireball has a volumetric, noisy, hot-to-cold gradient (not a flat sprite)
- [must] Smoke looks volumetric (lit from fires below, wind-bent) and never hides the player without a silhouette
- [should] Car explosions: the car jumps, parts detach, and the wreck burns
- [should] Fire flickers, emits embers, and lights its surroundings
- [should] The intensity matches the class (a small grenade ≪ a mega gas station)

## 8. Balance and difficulty metrics

The sim-runner's balance job (`npm run test:balance`) runs `complete` ×20 and `newbie` ×20 per level and writes `test-results/balance/<level>.json` plus a Markdown summary:

| Metric | Band (default) |
| --- | --- |
| `newbie` completion rate | ≥ 80–90% (per-level spec) |
| `newbie` median time | 5–10 min (L5/L6: 7–10) |
| `newbie` median deaths | ≤ 2 (L1–L3), ≤ 3 (L4–L5), ≤ 4 (L6) |
| `idle` survival time | ≥ 20 s in L1 segment 1; < 120 s in any combat segment (difficulty floor exists) |
| Power score L1→L6 | monotonic increase; L5 ≥ 3× L1 |
| TTK table | within the per-weapon bands (`src/data/balance.ts`) |

A band violation fails the level epic's tests. Tuning changes data files only.

## 9. Artifacts and reporting

```
test-results/
  epics/E<NN>/            report.md, review.md, *.png, compare/*.png, logs/
  balance/                <level>.json, summary.md, ttk.json
  perf/                   <scenario>.json, devices/*.json
  assets/<id>/            turntable_*.png, validate.json
  recordings/             *.ssrec (failing bot runs)
  playwright/             html report, traces (on failure)
```

The agent's epic report must quote the actual numbers (pass counts, medians, budgets) taken from these files, never from memory.

## 10. Flakiness policy

- Sim tests are deterministic, so **no retries** are allowed. A flaky sim test is a determinism bug.
- Browser tests: at most 1 retry in CI. A test that needed the retry is reported in the summary and becomes a ticket.
- Visual goldens are generated only on the pinned Chromium + SwiftShader + DPR 1 setup. Cross-machine differences are handled with per-spot thresholds, never by raising the global threshold.
- Time-scaled browser playthroughs run at a scale of 4 or less (2 for driving) to avoid catch-up starvation. The sim's catch-up cap is raised in test mode (`maxCatchUp=20`).

## 11. Verifying an epic: the agent's procedure

1. Read the epic file, `04-epics-overview.md` (DoD), this document, and the relevant test-plan rows in `91-test-plan.md`.
2. Write or extend scenarios and photo spots first. Write failing tests tagged `@E<NN>-ACxx`.
3. Implement.
4. Run `npm run verify -- E<NN>`, which runs the static, unit, sim, e2e, visual, and perf tests tagged for the epic, plus the smoke suite.
5. Generate the comparison sheets and perform the vision reviews (§7.1). Write `review.md`.
6. Write `report.md`: acceptance-criterion table (ID, PASS/FAIL, evidence file), metrics, deviations, known issues.
7. Run the smoke suite and the previous epics' tagged suites (`npm run test:regression`) before declaring done.

## 12. What automation does not cover (human playtest)

Fun, game feel (weight of hits, car handling), clarity for a first-time player, the tone of the story beats, and audio mix quality. At each milestone, run a **human playtest protocol**: 3–5 players per scheme (mouse-only, keyboard, touch), a think-aloud first session, a post-session questionnaire (SUS-style controls clarity, 1–5 fun per level, "when were you confused?"), and recorded inputs (`.ssrec`) plus telemetry for later bot calibration. If humans' median times differ from the `newbie` bot by more than 25%, the `newbie` profile parameters get recalibrated.
