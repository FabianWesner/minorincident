# M1-22 — L1 objective transition stalls

Baseline: production build of pristine commit `1292268` in detached worktree `/tmp/m1-hitch-baseline-1292268`. This lane merged main once (already up to date).

## Cause

Entering the diner completes breakfast and calls `SimWorld.setTier(1)`. The old path synchronously assembled the district, rebuilt its collider and static navigation data, then `Game.refreshView()` reloaded the entire presentation: characters, NPCs, GPU crowd animation batches, VFX, renderer caches and audio. A CDP trace captures a 5797.9 ms renderer main-thread task. A separate CDP CPU profile on the pristine production build attributes roughly 5 seconds to WebGL `getProgramParameter` calls during that reload. Initially hidden infected and VFX were absent from visible-scene compilation; high-detail infected and district prototypes streamed at first use. An intermediate fix removed the JS stall but exposed deferred Metal GPU tasks of 230.9/190.6 ms.

## Change

L1 prepares W0/W1 district compositions and static occupancy during loading. Tier changes retain the live render scene, shared materials, crowd pools, audio and camera, and select the prepared district group. Dynamic blockers update only affected cells, including the previous footprint when moved. L1 loads all required infected and district LODs before gameplay. A Bruno PreRenderer adaptation compiles hidden weapon/infected/VFX variants in the actual HDR/MSAA gameplay context, draws representative instances at a small loading resolution, then awaits the WebGL GPU fence. Both one-instance and multi-instance draws are exercised: Three uses a non-instanced native draw at count 1 and switches to the instanced native draw above 1; Metal specializes these separately. L1 district pools allocate beyond the backend's uniform-buffer limit to select Three's vertex-attribute matrix path, sharing shader code across placement counts. Live counts and bounds are preserved. This reduced measured loading from 150.3/93.5 seconds (desktop/mobile) with small uniform-array buffers to 20.1/18.9 seconds. Animated infected/civilian batches are also drawn individually without opaque occluders. A new RAF separates every draw because Three caches render passes per frame, even when its GPU fence is already signaled. Visibility, instance matrices/counts, culling and dimensions are restored even if warming fails. Other scenarios retain their existing loading behavior.

## Measurement

`tests/perf/l1-transitions.spec.ts` runs a production preview headlessly on WebGL2 ANGLE Metal (Apple M1 Max), at desktop 1600×900 and Pixel 7 emulation 390×844, DPR 1; the menu defaults select high quality on desktop and low on mobile. Real ground clicks walk into the diner and hardware rings. Real key/mouse input picks up the weapon and lands a combat hit; test API damage triggers death/respawn and objective completion opens the end screen. Restart uses its actual UI button. The probe records `performance.now()` deltas on every RAF plus ticks/objectives/phase and saves a separate Chrome CDP trace per transition. It requires advancing simulation and max frame ≤50 ms. E19 runs the frame gate serially after other browser checks.

Baseline max frames: desktop diner 5801.7 ms, hardware 446.1 ms, pickup/store spawn 58.7 ms, store fight 253.4 ms; mobile 5043.9/187.5/26.9/47.0 ms respectively. The baseline combat probe reached the result screen before its death action; baseline death/respawn, end and restart measurements are therefore omitted. Final production maxima: desktop diner 24.0 ms, hardware 20.3, pickup/store spawn 19.6, store fight 19.4, death/respawn 18.7, end screen 18.5, restart 18.9; mobile 23.8/18.5/18.7/18.4/19.0/18.3/18.2 ms. All fourteen transition windows pass the 50 ms budget, with no late WebGL program links or blocking link-status queries. The regression suite passes both tests (2.0 minutes).

Raw per-frame samples and CDP traces: `test-results/epics/E19/hitch/`. Lightweight maxima: `m1-22-frame-maxima.json`.

## Validation

Typecheck, lint and production build pass. All 155 unit tests pass across 57 files. `npm run test:smoke` passes three simulation/unit checks and all 22 browser checks. The focused production transition regression passes both device tests, covering all fourteen transition windows at the unchanged 50 ms budget.

The final `npm run verify -- E19` passes typecheck/lint/build and 39 selected tests. It stops on two inherited navigation failures in `tests/sim/m1-world.test.ts`: M1-08 forecourt arrival (2.5820746000804036 m, expected <0.15) and M1-07 hedge routing (4.207687608483755 m, expected <0.15). Both reproduce with exactly the same values on pristine `1292268`; classified **baseline** per orchestrator instruction. No hedge or forecourt changes are included. Baseline log: `hitch/baseline-navigation.log`.

An earlier overloaded run hit three simulation timeouts. Those passed an isolated diagnostic retry and then the final normal E19 run at the original timeout.

A broader E19 browser run was interrupted by the scheduler time limit. Before interruption it observed a mobile triangle-budget assertion (519538 versus 500000), desktop playthrough death count, crowbar middle-click pickup, and desktop animation failures. These were not independently classified as baseline. The orchestrator explicitly removed the full E19 suite from the resumed scope and handles those checks elsewhere; this report does not claim that suite passed.

Raw CDP traces and per-frame samples remain locally in `hitch/`; the committed lightweight maxima are in `m1-22-frame-maxima.json`.

## Main integration — bc7e801

Merged main once in `b652fa7`. Resolved ActionView, GameView, PaletteMaterial and PostFx by retaining lane district/pipeline prewarming together with main's shared look controls, palette detail, asset materials and low-quality DOF. The mission test resolution retains both prepared-district/restart coverage and main's M1-23/M1-24 outbreak checks.

Regenerated `assets/animation-library/library.glb` with `assets/animation-library/build.py`, then regenerated `src/render/characters/library.json` using `tools/assets/animation-library.ts`. The reproducible outputs contain all 51 main clips (48+3) and all 48 lane clips; the lane set is a subset of main. Outputs match main's generated assets; no binary hand merge was used.

Post-merge typecheck and lint pass. All 181 unit tests pass across 59 files with two workers. The first run hit the existing asset-inventory 120-second timeout while concurrent animation exports were active; the full retry passes at the unchanged timeout. Smoke passes three simulation checks and all 22 browser checks. The one focused production browser file passes both desktop and mobile tests with all fourteen windows below 50 ms: desktop maximum 24.7 ms; mobile maximum 22.6 ms. Per-window integration measurements and late shader calls are recorded in `m1-22-frame-maxima.json`; fresh raw samples and CDP traces remain in `hitch/`. Browser runs use the shared lock and port 3344. The broad E19 suite was excluded as instructed; earlier baseline classifications remain historical.
