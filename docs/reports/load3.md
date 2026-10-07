# load3: startup loading policy

## Measurements

**Phone passes the ≤9.5 s median target; desktop improves.** Historical metric: L1 selection → first playable frame, including the Begin-mission interaction (`07173814` records 17.8 s phone cold). No deliberate reading delays; three independent cold contexts per profile.

| Profile | Before runs (s) | Before median | After runs (s) | After median | Critical wire MB before → after |
|---|---|---|---|---|---|
| Phone 4G | 16.967 / 17.207 / 17.116 | 17.116 s | 9.489 / 9.367 / 9.383 | **9.383 s** | 23.000 → **13.056** |
| Desktop | 6.104 / 6.491 / 6.349 | 6.349 s | 5.194 / 4.967 / 4.982 | **4.982 s** | 29.256 → **22.815** |

Navigation → playable medians, including title/menu time: phone **21.697 → 13.446 s**, desktop **7.783 → 6.399 s**. The navigation metric has not reached 9.5 s; the historical L1-selection metric has.

Phone: touch/mobile 412×915, DPR 1, 10 Mbps down /3 Mbps up /150 ms RTT. Desktop: 1600×900, 50 Mbps down /10 Mbps up /20 ms RTT. Existing CDP profile, headless Metal Chromium, automatic renderer (WebGPU confirmed by capture API). TLS/SPKI-pinned local HTTP/2 server applies production `_headers`: Brotli text/WASM, **raw GLB/KTX2**. No sidecar gzip files or deployment.

Baseline is merged commit 0f885ece. Its default-renderer run deadlocked after L1 selection, so the recorded before batch uses `?preload=0`; after uses default preload. This is an explicit measurement deviation: the comparison includes the repaired preload policy. Frozen builds prevent the unit build test from replacing benchmark files. After startup snapshot: 9e356544; subsequent commits only retire resources, settle the audio suspension fixture, retain streamed shadow flags and clarify the same tier-selection logic.

[Run summaries](load3-timings.json). Complete per-file critical-path tables: [phone](load3-phone-critical-path.csv), [desktop](load3-desktop-critical-path.csv). Values are median CDP bytes received by the playable mark, including partial streams; complete responses include response headers. Build hashes are normalized to HASH. A whole music stream is not counted merely because its request began before play. These wire totals do not use virtual gzip savings.

### Largest phone critical-path removals

| File | Before bytes | After bytes |
|---|---:|---:|
| /assets/models/bld.house-c.lod1.glb | 937,757 | 0 |
| /assets/models/bld.house-a.lod1.glb | 901,243 | 0 |
| /assets/models/veh.suv-green.lod1.glb | 843,656 | 0 |
| /assets/models/bld.mainstreet-brick.lod1.glb | 834,874 | 0 |
| /assets/models/bld.gas-station.lod1.glb | 785,040 | 0 |
| /assets/models/bld.house-b.lod1.glb | 750,734 | 0 |
| /assets/models/veh.courier-van.lod1.glb | 731,721 | 0 |
| /assets/audio/ambience.webm | 386,935 | 0 |
| /assets/models/veh.pickup-red.lod1.glb | 272,327 | 0 |
| /assets/audio/music-L1.webm | 270,627 | 0 |
| /assets/models/veh.pickup-white.lod1.glb | 237,950 | 0 |
| /assets/models/veh.suv-dark.lod1.glb | 229,663 | 0 |

## Cause and implementation

Git binary-size history identifies LOD repairs in cb8564e4: +12,588,176 bytes across model exports, **+6,675,892 bytes in the old phone critical-file set**. House-C LOD1 grew 104,872 → 937,176 bytes; house-A 129,100 → 900,688; SUV-green 208,404 → 843,120. The bike rebuild added about 21 KB. Startup still fetched tiers it never drew.

- Phone props fetch LOD2 only. Buildings fetch their spawn tier, aggregated across placements. Unused near/far tiers stream nearest-first after gameplay begins. Existing distance thresholds and production meshes remain in use.
- High L1 keeps spawn detail; WebGL warms nearby LOD0 and other route/intermediate tiers stream after Begin. WebGPU retains its nearby prototypes. Other levels retain their existing non-prop initialization policy.
- Prefetch requests reduced tiers. Loadout/pickup weapons stay immediate; the unused catalogue loads on first use.
- Score streams, ambient/music banks and lazy SFX wait for gameplay. UI, impact, bark and L1 story cues remain ready. Ambient/music start may be delayed by their bank download.
- Generic EntityAssets also loaded/drew the cargo bike owned by BicycleView. Remove that second rigid bike and its unused phone LOD1; the animated LOD0 bike is unchanged.
- Preserve foreground level picks across preload awaits, fixing the baseline deadlock.
- Memory tests begin the mission and settle streaming consistently. Dispose bike extras and the separately attached character parcel.

## First ten seconds

Seed 1 L1, Begin mission, deterministic captures at 0/2/5/10 simulated seconds on phone and desktop. Initial visible assets are settled before Begin; captures do not await full background route preparation. Inspected before/after and diff masks: differences are confined to the removed duplicate bike and its shadow (phone 1.07–1.31%, desktop 0.92–1.23% of pixels, pixelmatch threshold 0.1). The rest of the scene retains its detail. Earlier policy-only WebGL captures before bike deduplication differed by zero pixels at all eight samples.

[Pixel counts](load3-visual-diff.json). Required captures and heap/download evidence are retained under test-results/epics/E18/load3/. This covers the standing spawn view through ten simulated seconds, not arbitrary traversal or physical-phone performance.

## Validation

- `npm run typecheck`, `npm run lint`, production builds: PASS.
- `npx vitest run tests/unit/assets/load-pipeline.test.ts tests/unit/assets/courier-bike.test.ts tests/unit/audio/registry.test.ts tests/unit/render/lod-policy.test.ts --maxWorkers=4`: **15 PASS /1 FAIL**, four files. The queued full-unit rerun was cancelled at the orchestrator’s request. Earlier `npm run test:unit -- --maxWorkers=4`: 239 PASS /1 FAIL, 75 files, before the parcel regression assertion. Failure: courier-bike.test.ts expects saddle X 0; authored model gives −0.39. Reproduced on merged baseline; no GLB/socket change here. The orchestrator will run the full suite on main.
- `E2E_PORT=3384 sh tools/sim-lock.sh sh -c 'npm run verify -- E18 > test-results/load3/verify-E18-release.log 2>&1'`: overall FAIL. Typecheck/lint/build PASS; unit/sim 18 PASS /583 SKIP; browser 29 PASS /8 FAIL; GPU/device 2 PASS /1 FAIL /4 SKIP. Heap and WebKit audio failures were subsequently repaired and rechecked. A prior contention-heavy sim timing run failed; the recorded rerun passes.
- `sh tools/sim-lock.sh sh -c 'npx vitest run -t @smoke --maxWorkers=2 > test-results/load3/smoke-unit.log 2>&1'`: 5 PASS /596 SKIP.
- `E2E_PORT=3383 sh tools/e2e-lock.sh sh -c 'npx playwright test --grep @smoke --workers=2 > test-results/load3/smoke-browser.log 2>&1'`: 20 PASS /2 FAIL (S-02 and initial WebKit deferred-music settling). Latest audio rechecks PASS; S-02 is untouched.
- `E2E_PORT=3385 sh tools/e2e-lock.sh sh -c 'npx playwright test tests/perf/e18-memory.spec.ts tests/e2e/audio/smoke.spec.ts --project=chromium --project=webkit --workers=1 > test-results/load3/heap-audio-recheck.log 2>&1'`: 4 PASS /2 FAIL, including high-memory PASS. Low memory/WebKit fixture then fixed.
- `E2E_PORT=3387 sh tools/e2e-lock.sh sh -c 'npx playwright test tests/perf/e18-memory.spec.ts tests/e2e/audio/smoke.spec.ts --grep "T-E18-05-low|S-11" --project=chromium --project=webkit --workers=1 > test-results/load3/heap-audio-final.log 2>&1'`:**3 PASS /0 FAIL**. Low heap 75,495,676 → 81,641,440 bytes (+8.14%), geometry count 652 → 652. High latest measured PASS: 81,155,036 → 89,194,676 (+9.91%), before further parcel cleanup.
- `sh tools/e2e-lock.sh sh test-results/load3/measure-baseline.sh` and `sh tools/e2e-lock.sh sh test-results/load3/measure-final.sh`: each invokes `npx tsx tools/performance/load-measure.ts <frozen-base> phone,desktop,phone,desktop,phone,desktop <out.json>`, with LOAD_CACHES=cold and LOAD_MENU_MS=0. Each uses a separate lock acquisition. Six samples each, no page errors; existing zero-vertex WebGPU warnings before/after.
- `sh tools/e2e-lock.sh sh test-results/load3/final-capture.sh`: before/after screenshots, both profiles, four timestamps, headless, separate lock acquisition. The retained helper can also be run as `CAPTURE_RENDERER=auto sh tools/e2e-lock.sh npx tsx test-results/epics/E18/load3/capture.ts <baseURL/> <outputFolder>` with LOAD_SPKI set to the server certificate public-key pin.
- Redundant broad load/transition rerun cancelled at orchestrator request to reduce the shared browser queue. Final transition frame-budget gates are unverified.

### E18 latest result per test

Updates the full verification run with targeted heap rechecks. [Detailed records/provenance](load3-e18.json).

| Test | Project/stage | Latest result |
|---|---|---|
| T-E19-perf 200 L1 infected with 40 humans: Node sim p95 <= 4 ms | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-02-200 Node sim p95 200 living infected <= 4ms | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-02-100 Node sim p95 100 living infected <= 6ms | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-tier-cap degradation defers distant ambient infected without awarding kills | unit/sim | PASSED (verify-E18-release.log) |
| E18 mobile GLB selection prefers declared .low export, preserves lod1 and releases its cache | unit/sim | PASSED (verify-E18-release.log) |
| E18 recording validation rejects emulation declarations, incorrect scenarios and invented summaries | unit/sim | PASSED (verify-E18-release.log) |
| E18 emulation evidence requires the authorized CPU profile and cannot masquerade as physical hardware | unit/sim | PASSED (verify-E18-release.log) |
| E18 low tier keeps at most 30 active gibs and resets removed physics slots | unit/sim | PASSED (verify-E18-release.log) |
| E18 level layouts retain shared districts and release documents outside the active level | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-04 adapts within 6 seconds and recovers only at next level start | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-04b defers degradation through a cinematic, ignores spikes and honors explicit settings | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-04c an exact budget cadence does not degrade due to Float32 rounding | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-07 selects low for mobile profiles and enforces distinct tier budgets | unit/sim | PASSED (verify-E18-release.log) |
| T-E18-07-Pixel 7 L1 touch gameplay, auto low, portrait/landscape and safe areas | chromium | PASSED |
| T-E18-07-iPhone 14 L1 touch gameplay, auto low, portrait/landscape and safe areas | chromium | PASSED |
| T-E18-04-browser auto drops high to low within 6s and only upgrades at level start | chromium | PASSED |
| T-E18-06 real WEBGL_lose_context restores draws in 3s while simulation remains paused | chromium | PASSED |
| T-E18-visibility background pauses and releases held input | chromium | PASSED |
| E18 perf overlay uses real counters and teardown leaves no scenario resources | chromium | PASSED |
| T-E18-01-high-perf-horde-200 fixed camera deterministic counters stay in tier budgets | chromium | PASSED |
| T-E18-01-high-perf-l6-mainstreet fixed camera deterministic counters stay in tier budgets | chromium | FAILED |
| T-E18-01-high-perf-l5-bridge fixed camera deterministic counters stay in tier budgets | chromium | FAILED |
| T-E18-01-low-perf-horde-200 fixed camera deterministic counters stay in tier budgets | chromium | PASSED |
| T-E18-01-low-perf-l6-mainstreet fixed camera deterministic counters stay in tier budgets | chromium | FAILED |
| T-E18-01-low-perf-l5-bridge fixed camera deterministic counters stay in tier budgets | chromium | FAILED |
| T-E18-03 production initial network payload <=15MB gzip through level.started | chromium | PASSED |
| T-E18-05-high five L1/L6 loads release heap and GPU resources | chromium | PASSED (heap-audio-recheck.log) |
| T-E18-05-low five L1/L6 loads release heap and GPU resources | chromium | PASSED (heap-audio-final.log) |
| T-E18-09 local headless native-GPU Chrome high horde p95 frame <=16.7ms | chromium | FAILED |
| E18 WebGPU low tier parity compiles two-mip bloom and capped crowds | chromium | SKIPPED |
| T-E18-08-physical physical iOS and Android recordings at final verification | chromium | SKIPPED |
| T-E18-08-android-webgl emulated mobile L6 at 4x CPU p50 >=30fps | chromium | PASSED |
| T-E18-08-android-webgpu emulated mobile L6 at 4x CPU p50 >=30fps | chromium | SKIPPED |
| T-E18-08-ios-webgl emulated mobile L6 at 2x CPU p50 >=30fps | chromium | PASSED |
| T-E18-08-ios-webgpu emulated mobile L6 at 2x CPU p50 >=30fps | chromium | SKIPPED |


E18-03 payload **PASS: 22,559,061 → 12,497,480 bytes gzip** under the unchanged E18 response-body metric. This metric differs from Pages wire delivery. E18-05 high and low are PASS on the latest recorded rechecks.

## Commits, deviations and remaining issues

Merged main first: 0f885ece. Implementation commits:

- c0f2d1f4 fix(load): retain early level picks across menu preload awaits
- 64c24933 perf(load): download only phone district tiers used at spawn
- ac9d1165 perf(E18): keep distant district tiers and unused weapons out of startup
- c0fe919a perf(load): start ambient beds and music after the first gameplay frames
- 77110af7 test(load): record playable frontier bytes and phone tier requests
- 744a7b71 fix(load): preserve nearby WebGPU detail before hero streaming
- be631442 fix(E18): dispose bike extras and resume deferred audio on foreground ticks
- 16a6d818 fix(load): avoid loading and drawing a second cargo bike
- 9e356544 perf(load): stream the unused far tier of nearby phone assets
- 598ce4d5 fix(E18): release carried parcels and settle deferred audio in suspension checks
- 2516b405 fix(load): preserve low far-tier shadow policy during streaming
- 35d580e8 refactor(load): clarify initial tier selection

No spec changes, asset GLB edits, push, merge of lane work into main, or deployment. Measurement deviation: baseline preload disabled to avoid its deadlock. Test fixtures now settle deferred audio/geometry before testing later suspension/leaks; budgets were not relaxed.

Remaining failures are retained: L6 high 729 draws /4,968,739 triangles; L5 high 512 draws /3,112,327 triangles; L6 low 577 draws /1,195,808 triangles; L5 low 465 draws /702,693 triangles. Those levels/budgets are left alone as requested. Native desktop horde p95 is 26.6 ms against 16.7 ms. S-02 belongs to the controls lane. The baseline bike saddle assertion remains. Four physical-device/WebGPU criteria are skipped/manual. Spawn stills do not certify arbitrary traversal or transition hitch budgets.
