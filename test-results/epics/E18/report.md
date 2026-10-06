E18 is complete under the orchestrator’s approved verification exceptions. All nine acceptance IDs have passing tagged tests, including the authorized emulated AC08 profiles. `specs/status.json` is `done`. Physical phone recordings are **deferred: manual real-device run**; final WebGPU verification also remains manual; the inherited E17 unit failure remains visible rather than being changed in this lane.

AC08 real-device recordings pending user run at final verification; emulated profiles recorded

Built the Bruno-derived high/low/auto service, sustained five-second p90 degradation with cinematic deferral and upgrades only at the next load; existing quality API/debug controls; throttled `?perf` overlay; tiered DPR, shadows, bloom, audio, gibs and crowd caps; prop LOD/culling; bounded layout caching; full-cap deterministic performance fixtures; mobile canvas sizing/visibility pause; and same-canvas WebGL context recovery. Below-integrated assets retain code placeholders. No dependency or asset registration was added. Touch HUD layout/CSS is unchanged.

Small verified slices covered measurement/policy, tier/lifecycle integration, acceptance tests, measured retention/rendering fixes, and the authorized headless/mobile finish. The low fixed-camera L6 scene initially used 323 draws; dropping detailed prop shadow casters reduced it below 300 while retaining building/vehicle/hero shadows. Heap diagnosis found shader binding nodes and WebGL VAOs retained across loads: unload now retires renderer-owned caches, scopes asynchronous binding creation to the actual render context, and disposes low-bloom inactive texture slots. These narrow Three 0.186 private hooks require review on a Three upgrade.

Native Metal exposed a crowd shader vertex-attribute overflow hidden by SwiftShader. Packing frame/limb/gore/flash into one vec4 fits Metal’s 16-location limit and reduces uploads without per-frame allocation. Native error guards and screenshots now prove the crowd draws. Float32 p90 sampling noise is rounded to 0.0001 ms so exactly 16.7 ms does not spuriously degrade; boundary and sustained-over-budget tests pass.

| Criterion | Tagged tests | Final evidence |
| --- | --- | --- |
| E18-AC01 | `tests/perf/e18-counters.spec.ts` | PASS: six fixed-camera high/low counter captures, JSON/PNGs |
| E18-AC02 | `tests/sim/performance/horde.test.ts` | PASS: high p95 1.580 / 4 ms, low 2.048 / 6 ms; full 200/100 population |
| E18-AC03 | `tests/perf/e18-download.spec.ts` | PASS: 3,625,817 / 15,000,000 gzip bytes through actual `level.started` |
| E18-AC04 | `tests/e2e/e18-quality.spec.ts`, policy/cap unit tests | PASS: degrade 5070 / 6,000 ms; cinematic deferral and next-load upgrade |
| E18-AC05 | `tests/perf/e18-memory.spec.ts` | PASS: L1→L6→L1→L6→L1 heap and GPU return counts within 10%; both tiers |
| E18-AC06 | `tests/e2e/e18-quality.spec.ts` | PASS: real context restoration 267 / 3,000 ms, no reload, sim paused |
| E18-AC07 | `tests/e2e/e18-mobile.spec.ts` | PASS: Pixel 7/iPhone 14 touch, auto low, both orientations, bounds/canvas caps |
| E18-AC08 | `tests/perf/e18-devices.spec.ts`, device-evidence unit tests | PASS: authorized Android 4× / iPhone-class 2× CDP mobile CPU profiles; physical portion deferred: manual real-device run |
| E18-AC09 | `tests/perf/e18-desktop.spec.ts` | PASS: native Metal WebGL2, high, 200 alive, raw p95 16.700000000001 ms / 16.7 ms |

| Fixed camera | High draws / triangles | Low draws / triangles |
| --- | --- | --- |
| Horde | 43 / 136,647 | 43 / 68,047 |
| L6 main street | 332 / 439,871 | 288 / 253,005 |
| L5 bridge | 263 / 294,729 | 219 / 178,459 |

Node measurements use seed 1, 120 warm-up ticks and 600 measured ticks with the full living population. Fixed-camera browser counters are deterministic captures rather than phone FPS evidence.

| Five-load memory | High | Low |
| --- | --- | --- |
| First / last L1 heap bytes | 20,552,648 / 22,441,236 | 20,363,520 / 22,267,848 |
| Heap growth | 9.19% | 9.35% |
| Peak heap bytes | 27,036,052 | 26,753,848 |
| First / last geometries | 107 / 107 | 106 / 106 |
| First / last textures | 18 / 18 | 15 / 15 |

Memory checks perform twelve rendered retirement frames and CDP collection per load without prewarming L6. Large heap snapshots are excluded; diagnosis is retained.

| Emulated mobile recording | CPU throttle | FPS p50 | Raw samples | Living infected |
| --- | --- | --- | --- | --- |
| Pixel 7 emulated | 4× | 59.88 | 1200 | 100 |
| iPhone 14 emulated | 2× | 59.88 | 1200 | 100 |

Both profiles use headless Chromium mobile viewport/touch on the M1 Max’s native Metal GPU and `/perf-device.html`’s actual low-tier L6 scenario. Five-second warm-up precedes 1,200 rendered intervals; raw durations, active/unpaused tick advancement, backend/GPU proof and CPU rate are recorded in `test-results/perf/devices/emulated-*.json`. These are CPU proxies, not physical iOS Safari/Android GPU measurements. The physical validator still rejects emulated recordings and automatically validates both platforms when physical files arrive. Open `/perf-device.html` on real phones from a LAN-served build and save its recordings to the same directory at final user verification.

All browser automation is headless with native Metal flags `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`. AC09 now measures native headless WebGL2 per the user’s explicit override of the headed recipe. It records 600 raw intervals after 120 warm-up frames, 720 rendered frames, >300 actual sim ticks and 200 alive. Nanosecond rounding only removes subtraction noise at the 16.7 ms assertion; raw samples are saved unchanged. WebGPU-only checks skip for manual verification under the user’s headless-only policy; earlier WebGPU PNG/JSON is historical, not final verification.

Final commands: `E2E_PORT=3330 npm run verify -- E18` and `E2E_PORT=3330 npm run test:smoke`.

| Check | Exit | Result |
| --- | --- | --- |
| typecheck | 0 | Both TypeScript configurations |
| lint | 0 | No warnings |
| build | 0 | Production, no new warnings |
| test:unit | 1 | 105 pass / 1 inherited E17 failure |
| test:smoke | 0 | 3 Vitest + 19 browser passes |
| verify -- E18 | 0 | 15 selected Vitest; 34 headless browser; 3 native browser passes, 4 authorized manual skips |

`checks.json`, `vitest.json`, `playwright-headless.json`, `playwright-gpu.json`, `unit.json` and `playwright-smoke.json` retain actual results. The sole full-unit failure is inherited `T-E17-sources @E17-AC05`: lane `bld.dugout.sourceGlb` metadata is absent. Main now has `assets/bld.dugout/model.glb`; the orchestrator explicitly instructed this lane to note the inherited failure, not fix it and not merge main. Full earlier-epic regression runs centrally; selected smoke and every other full-unit case pass.

Visual screenshots and the honest §7 checklist are in `review.md` and `compare/`. Tier landmarks/glow/shadows, native crowds and restored rendering pass inspection. Full-game composition remains FAIL for inherited phone HUD overlap and portrait fog/framing; mobile-hud and camera/lighting owners must recapture after integration. Bounds checks do not claim those issues are fixed. Placeholder art detail remains an asset integration follow-up.

All runs use the machine-wide browser lock, port 3330, ≤2 Playwright workers (native pass one) and ≤4 Vitest workers. This worktree owns its node_modules. No push, deploy, secret read, protected-reference edit, later asset registration or main merge was performed. The whole source diff was reviewed; tier/retention hooks are limited to measured costs. Only the explicitly authorized AC08 note and status change edit specs; no numerical acceptance budget was weakened.

Source commits: `904d176`, `c876e2e`, `12e8273`, `25baeb4`, `cb05ab7`, `d479538`, `2f3a076`; original evidence `7f0814c`; refreshed evidence/report/status committed separately.
