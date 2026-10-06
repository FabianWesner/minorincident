E18 is implemented but **not complete**. AC01–AC07 and AC09 pass their tagged tests. AC08 is **BLOCKED** by absent physical iOS/Android recordings. Full unit validation also fails an inherited E17 asset-registration test. `specs/status.json` remains `in-progress`.

Built the Bruno-derived high/low/auto policy, sustained five-second p90 degradation with cinematic deferral and upgrade only at the next load, quality settings through the existing API/debug pane and URL, a throttled `?perf` overlay, tiered DPR/shadows/bloom/audio/gibs/crowds, existing prop LOD selection, bounded layout caching, deterministic full-cap performance fixtures, mobile canvas resizing and visibility pause, and same-canvas WebGL recovery. Below-integrated assets retain the existing placeholders. No dependencies or asset registrations were added. Touch HUD layout/CSS remains unchanged, as requested by the orchestrator; no floating quality UI was retained.

Work proceeded in verifiable slices: (1) measure existing E07/E10 performance gates and port the quality policy with unit tests; (2) integrate tier settings, lifecycle and mobile rendering; (3) exercise every tagged acceptance gate; (4) fix the measured rendering/disposal costs and repeat the gates. Existing horde/district baseline JSON is retained. The full-cap low L6 fixture initially measured 323 draw calls; removing detailed prop shadow casters reduced it to 288 while preserving the fixed camera, landmarks and population. Building/vehicle/hero shadows remain enabled.

Heap snapshots identified retained shader binding nodes and WebGL VAOs. Unload now retires renderer objects, node data, lists and contexts and releases fallback VAOs. During Three 0.186 asynchronous warm-up, its shared binding cache used the persistent renderer as its key and pinned old level uniforms; the node-builder hook scopes binding creation to the actual render context. Low bloom also needed explicit disposal of the three sampled but never-rendered inactive texture slots. Layout caching retains only the active level's districts. These narrow hooks into pinned Three internals need revalidation when Three is upgraded; both WebGL2 and native WebGPU pass the current gates.

| Criterion | Tagged test | Final result / evidence |
| --- | --- | --- |
| E18-AC01 | `tests/perf/e18-counters.spec.ts` | PASS: all six fixed-camera tier/scenario combinations; corresponding JSON and PNG |
| E18-AC02 | `tests/sim/performance/horde.test.ts` | PASS: high p95 1.559 ms / 4 ms; low p95 0.835 ms / 6 ms; `sim-200.json`, `sim-100.json` |
| E18-AC03 | `tests/perf/e18-download.spec.ts` | PASS: 3,625,863 bytes gzip / 15,000,000 through actual `level.started`; `download.json` |
| E18-AC04 | `tests/e2e/e18-quality.spec.ts`, policy/cap unit tests | PASS: auto degraded in 5,721 ms, stayed low after cost removal and upgraded at next load; cinematic deferral unit test; `adaptive.json` |
| E18-AC05 | `tests/perf/e18-memory.spec.ts` | PASS: L1→L6→L1→L6→L1 heap growth below 10%, GPU counts return to first load; `memory-high.json`, `memory-low.json` |
| E18-AC06 | `tests/e2e/e18-quality.spec.ts` | PASS: real loss/restore resumed draws in 143 ms without navigation, sim remained paused then could resume; `context.json`, PNG |
| E18-AC07 | `tests/e2e/e18-mobile.spec.ts` | PASS: Pixel 7/iPhone 14 touch L1 gameplay, auto low, both orientations, no document/control bounds overflow and capped canvas; profile JSON/PNGs |
| E18-AC08 | `tests/perf/e18-devices.spec.ts` | BLOCKED: physical iOS and mid-range Android recordings absent; emulation is rejected |
| E18-AC09 | `tests/perf/e18-desktop.spec.ts` | PASS: native Apple Metal WebGPU high, 200 living infected, p50 8.3 ms, p95 9.9 ms / 16.7 ms; `desktop-gpu.json` |

| Fixed camera scenario | High draws / triangles | Low draws / triangles |
| --- | --- | --- |
| Horde 200 / 100 | 43 / 136,647 | 43 / 68,047 |
| L6 main street | 332 / 439,871 | 288 / 253,005 |
| L5 bridge | 263 / 294,729 | 219 / 178,459 |

Both Node measurements use seed 1, 120 warm-up ticks and 600 measured ticks; every measured tick retains its full population (200/100). High sim p50 is 0.740 ms and low p50 is 0.284 ms. Browser counter tests are frozen deterministic captures and are not real-device FPS evidence.

| Five-load memory metric | High | Low |
| --- | --- | --- |
| First L1 heap | 20,520,940 bytes | 20,342,620 bytes |
| Last L1 heap | 22,349,068 bytes | 22,180,972 bytes |
| Heap growth | 8.91% | 9.04% |
| Peak L6 heap | 26,961,816 bytes | 26,673,068 bytes |
| First / last geometries | 107 / 107 | 106 / 106 |
| First / last textures | 18 / 18 | 15 / 15 |

The memory gate performs twelve rendered retirement frames and CDP collection after each load, without prewarming L6. The final peak L6 heaps remain below 400/250 MB. Shader/VAO retainer diagnosis is summarized in `heap-diagnosis.json`; large heap snapshots are excluded from the commit.

AC09 uses headed Chrome on this M1 Max's built-in 120 Hz display with native vsync, a 1600×900 logical viewport and DPR 1. The saved bounds identify the window on that display (`display-profile.json`, `desktop-gpu.json`). The raw log contains 600 measured intervals after 120 warm-up frames, 720 rendered frames, 360 simulation ticks and native Apple Metal adapter proof. Low-tier two-mip bloom/full 100 crowd WebGPU parity also passes. Earlier default-window results on an external 60 Hz display had p95 17.8 ms and remain in `desktop-gpu-external.json`; an empty-scene diagnostic also showed pacing jitter (`frame-diagnosis.json`). No frame limiter, vsync override, percentile substitution or acceptance-budget change was used.

Final verification command:

```sh
E18_GPU_WINDOW_LEFT=1950 E18_GPU_WINDOW_TOP=100 E2E_PORT=3330 npm run verify -- E18
E2E_PORT=3330 npm run test:smoke
```

| Check | Exit code | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Both TypeScript configurations pass |
| `npm run lint` | 0 | No warnings |
| `npm run build` | 0 | Production build, no new warnings |
| `npm run test:unit` | 1 | 102 pass / 1 inherited E17 failure; `unit.json` |
| `npm run test:smoke` | 0 | 3 Vitest smoke checks / 19 browser checks pass; `playwright-smoke.json` |
| `npm run verify -- E18` | 1 | 13 tagged/smoke Vitest pass; 34 headless pass / AC08 fails; 2 native GPU pass |

`checks.json`, `vitest.json`, `playwright-headless.json` and `playwright-gpu.json` preserve the final verify results; `playwright-smoke.json` preserves the dedicated final smoke run. The full unit suite's sole failure is inherited `T-E17-sources @E17-AC05`: `bld.dugout` has no `sourceGlb`. The same missing metadata exists at base `ab7df4e`; this lane does not change the manifest. There are 28 tracked source exports requiring registration by the owning asset integration lane. Earlier E07/E10 baseline browser gates passed, all other unit cases passed and smoke exercises the existing desktop, mobile and WebKit profiles. Full earlier-epic regression remains central under the latest integration instructions.

Visual evidence and the §7 checklist are in `review.md`, `compare/` and the scenario/mobile/context/native PNGs. High/low landmarks, tint, glow and restored rendering pass inspection. The overall full-game composition review fails inherited phone HUD overlap and portrait fog/framing, with additional checklist evidence limitations documented explicitly. The separately assigned mobile-hud lane owns layout/CSS; portrait camera/fog coupling needs the camera/lighting owners and recapture at integration. Passing AC07 bounds does not claim those vision findings are resolved. Placeholder art detail is not an art blocker.

BLOCKED completion requires real iOS and mid-range Android L6 recordings and resolution of the inherited E17 unit failure by its owning lane. For AC08, serve this production `dist` on the LAN (for example `npx vite preview --host 0.0.0.0 --port 3430 --strictPort --configLoader runner`), open `/perf-device.html` on each physical phone, enter its model, keep the page visible through five seconds of warm-up and 1,200 rendered frames, and save the downloaded JSON to `test-results/perf/devices/`. The tagged validator checks platform/model/date, L6 low tier, 100 living infected, raw intervals/duration and p50 >=30 fps. No Android hardware was attached (`adb devices` empty); no fabricated recordings or test skips were introduced.

All browser runs use the machine-wide lock, port 3330 and at most two workers; the native pass uses one. Vitest is capped at four. This worktree has its own node_modules directory. No deployment, push, secret read, protected reference/art edit, new dependency, criterion change or weakening occurred. Per the later integration rule, main was not merged again and later assets were not registered. Status cannot be set to done while these gates remain unmet.

Source commits: `904d176` quality policy/tests; `c876e2e` tier/recovery integration; `12e8273` HUD ownership separation; `25baeb4` acceptance measurements/device recorder; `cb05ab7` renderer/layout retention fixes; `d479538` reference display placement and existing quality API. Final evidence/report is committed separately. The whole source diff was reviewed for scope and unnecessary complexity before the final verify/smoke reruns.
