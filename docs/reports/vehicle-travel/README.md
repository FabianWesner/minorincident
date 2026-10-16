# Vehicle travel — 2026-10-16

Baseline: `8718d0fb1`. Changes: `5221e9afa` (the audit's actual-player-bus fixture correction) and `4bfc40624` (presentation, persistent browser clicks, regressions and catalog scenes). This report closes the targeted convoy jitter and ordinary Sam→Mia travel failures; it does not declare E22/E23 complete.

The corrected baseline reproduces **4.690 px RMS** at 60 Hz ([log](evidence/bus-baseline.log)). The large excursion came from the follow lens shortening against Fairhaven facade boxes and abruptly returning when the focus entered a box. Fixed-tick camera interpolation could not smooth that discontinuous framing policy. The seated convoy now retains its overview lens distance. Scripted actor poses are also captured after every fixed simulation tick alongside the camera, preserving the actual penultimate pose through acceleration and multiple ticks per draw. Previously they reconstructed that pose from the last drawn sample. The existing wheel/LOD tests and a new accelerated multi-tick regression cover the shared presentation path.

The full L5 browser baseline reproduces the audit's exact **(−52.53, 41.13)** stop ([log](evidence/l5-baseline.log)). Progress snapshots showed two healthy followers, an accepted Mia destination and no live infected nearby. On Hetzner, repeating the helper's cancel-and-click command every 18 ticks reproduces that same oscillation with infected removed ([diagnostic](evidence/repeated-click-diagnostic.log)); retaining one click reaches Mia ([diagnostic](evidence/persistent-click-diagnostic.log)). The helper now leaves an accepted destination active and re-clicks after command consumption/cancellation, including respawns; its existing covering fire, regrouping, cues, discovery interactions, photo assertions and handover remain in use. Failure-only state/screenshot capture records future travel stalls. A separate ordinary-input regression starts at the audited corner and reaches the authored Mia ring. L5 tuning, placements, survivor protection and difficulty are unchanged.

| Check | Fresh result |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | Pass |
| Hetzner renderer regressions | 14/14 pass ([log](evidence/renderer-unit.log)) |
| Hetzner persistent-click regression | 1/1 pass ([log](evidence/travel-regression.log)) |
| Full Hetzner `tests/unit tests/sim tests/levels --maxWorkers=4` | **2,937 passed / 0 failed / 11 intentionally skipped; 467 files passed / 3 skipped**, exit 0 ([log](evidence/full-remote.log)); includes PO #29 balance and both continuous L1→L6 policies |
| Native bus suite: all 17 original cadence/backend/tier configurations | **17/17 pass; 0.0136–0.0886 px RMS ≤0.6** ([summary](evidence/bus-summary.json), raw samples beside it) |
| T-E23-17 complete ordinary-input browser playthrough | **Pass, 2.8 min wall time; five sheltered and carried into L6, zero deaths, all nine existing photos, all five cue assertions, zero console errors** ([result](evidence/l5-real-input.json), [log](evidence/l5-real-input.log)) |
| L4/L5 native high/low performance | **4/4 pass** ([raw measurements](evidence/performance-summary.json)) |
| Scene Lab WebGL2: two scenes × two tiers × zoom 1.5/1/0.5 | **12/12 pass** ([catalog](evidence/matrix-webgl/index.md)) |
| Scene Lab WebGPU: same matrix | **12/12 pass** ([catalog](evidence/matrix-webgpu/index.md)) |

Across the changed Scene Lab matrix, high peaks at 79 draws / 261,827 triangles and low at 80 draws / 145,499 triangles, within E18 counters ([summary](evidence/scene-matrix-summary.json)). Scene Lab CPU step timings are not substituted for the native frame measurements.

The bus fixture is exactly the audit correction: it selects the authored first passenger bus (index 2). The RMS calculation, 0.6 px threshold, sample minimum, on-screen subject check, four rolling-wheel assertions and lead-vehicle condition are retained. Each of the 17 raw JSON files records the subject index, wheel deltas, frame count and samples.

| Native measurement | High | Low (4× CPU) |
| --- | --- | --- |
| L4 war p50 / p95 | 9.7 / 12.5 ms | 27.3 / 32.6 ms |
| L4 collapse p50 / p95 | 8.8 / 11.5 ms | 25.5 / 33.8 ms |
| L4 turn / tank / break maximum | 20.0 / 17.4 / 26.5 ms | 64.5 / 45.1 / 68.3 ms |
| L4 war / collapse draws | 365 / 307 | 207 / 278 |
| L4 war / collapse triangles | 570,814 / 572,643 | 292,506 / 310,693 |
| L5 walk p50 / p95 / max | 9.1 / 12.4 / 17.8 ms | 24.5 / 33.2 / 52.2 ms |
| L5 pair / follow draws | 324 / 324 | 237 / 237 |
| L5 pair triangles | 641,735 | 299,626 |

These pass the unchanged desktop/phone budget tests and E18 draw/triangle counters. **The separate E22 literal 50 ms transition requirement still fails on low** (turn 64.5 ms, break 68.3 ms); the phone tests permit 80 ms. Low collapse p95 33.8 ms also exceeds the optional strict-phone 33.3 ms gate, which was not enabled. No limits were changed. This lane did not remeasure the audit's separate warmed heap-retention failure or real devices, and makes no complete E18 claim.

The native batch used a fresh production build, headless Chromium/Metal, one Playwright worker and unique ports through `tools/perf/quiet-run.sh`, which owns the browser locks. Admission recorded load 2.59, zero other headless Chrome and zero local Vitest ([conditions](evidence/quiet-conditions.jsonl)). **21/21 passed in 8.2 minutes** ([log](evidence/quiet-native.log)). The outer 1,190-second deadline included queue/preflight/testing; the command completed within it and released its reservation. An earlier preflight reservation was released without taking measurements; ordinary browser work ran between attempts. Every local browser command used a unique E2E/Scene port, headless mode and one worker/session. No server used port 3300.

I opened the WebGL and WebGPU high/low game-camera sheets at zooms 1 and 0.5 for both new catalog scenes. The convoy at zoom 1 shows the long white EVAC bus, rolling near-side wheels, bright lamps, intact storefronts and the road moving behind it. At zoom 0.5 the bus fills the frame and is cropped at the roof/front; this is close player zoom rather than an overview of the whole column. Low retains the bus silhouette and lights, with reduced lighting detail. The Sam→Mia sheets show departure from the fence corner, passage along the street/building edge and arrival at the stairwell with the two followers. Roofs obscure the courier in several middle frames; these are route/admission captures, not a passing whole-level visibility score. Both backends retain the same bus, lighting/crop and roof-occlusion patterns in these views; no backend-specific missing bus or follower is visible. Scene Lab removes infected for this fixture; protection is proved by the separate full ordinary-input playthrough.

I also opened the fresh production [ride](evidence/ride-bus.png), [sign of life](evidence/l5-sign-of-life.png), [group of five](evidence/l5-group-of-five.png) and [closed Metro shutter](evidence/l5-metro-doors.png). The sign frame shows the wrecked bus, fence and debris in pink fog. The group frame shows the courier/corgi, fallen infected and five full-health survivor portraits (60/60); several character bodies have broken/jagged surfaces, consistent with the audit's separate renderer concern. The shutter frame shows the closed slatted door, stairs, gathered people above and all five healthy portraits. The capture is tightly framed and crops much of the group. These observations do not establish E23-AC18's complete vision score.

No simulation collision code, `src/assets/staticCollision.ts`, specs, difficulty tuning, forbidden references or art assets were edited. No deploy or merge was performed. The final fresh `git fetch origin main` confirmed both local and remote `main` remained `8718d0fb1`; collision-registry integration was therefore unavailable and is not claimed as tested. Epic-wide `npm run verify -- E22/E23` was not rerun; the targeted native gates above and the full remote sweep are reported separately.
