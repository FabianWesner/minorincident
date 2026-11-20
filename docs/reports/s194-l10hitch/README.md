# s194 — L10 first infected frame hitch

**Status: fix implemented; remote suite pending.** The PO report is a frame hitch at the first infected during L10, seed 1, cure-crash checkpoint, around tick 489 (8.2 s), at player `(551.55, -0.06)`, district D-CURE near crash-machete, WebGPU high, with 7 infected alive.

## Reproduction and trace

`tools/perf/s194-l10hitch.ts` is a headless checkpoint trace harness. It loads L10 from `cure-crash`, starts the mission, replays the existing seed-1 L10 input recording, records player position and shader build count and request-animation-frame intervals through tick 600, and samples the existing CPU categories (simulation, AI, crowd, view, render, audio, and others) along with infected counts. Run it during a quiet reservation:

```sh
E2E_UNITS=1 SCENE_PORT=5144 sh tools/perf/quiet-run.sh npx tsx tools/perf/s194-l10hitch.ts webgpu high before
```

A quiet headless run on 2026-11-20 produced these baseline numbers (1600×900, DPR 1, muted audio, seed 1):

| Backend / tier | Frames | Worst | p99 | Frames over 100 ms |
| --- | ---: | ---: | ---: | ---: |
| WebGPU high | 1,658 | 54.7 ms | 26.8 ms | 0 |
| WebGL2 high | 1,001 | 312.6 ms | 45.1 ms | 1 |

Both runs first showed seven infected at tick 10; the WebGPU replay was at x=581.19 at tick 489, rather than the PO's x=551.55. Thus this checkpoint trace does not establish that it reproduces the first visible spawn. The WebGL2 worst interval ended at tick 28. The preceding sample at tick 10 recorded the first seven infected, ten new shader builds, and 295.3 ms in render; that render falls inside the following RAF interval. This implicates the first draw and shader/pipeline work, although the trace does not separate compilation from uploads. The loading path had prepared only the runner fallback corpse tier before play. The fix prepares the planned living tiers for the opening regular looks and crawler behind the loading card. On the same quiet trace WebGL2 high improved from 312.6 to 95.1 ms worst and 45.1 to 33.2 ms p99 (1,269 frames, no frames over 100 ms). WebGPU high changed from 54.7 to 90.4 ms worst and 26.8 to 24.0 ms p99 (1,765 frames, no frames over 100 ms). A subsequent quiet WebGPU low after run measured 57.4 ms worst and 21.8 ms p99 across 2,001 frames, with no frames over 100 ms; a low baseline is unavailable. Audio was muted, so audio decode was not measured.

Earlier attempts were blocked by sandbox `spawn EPERM` and browser-pool `listen EPERM`; those restrictions have since been lifted. Raw traces are in `test-results/s194-l10hitch/` locally.

## Code review findings

L10 already has a full warm-up behind the loading card. `CrowdView` registers the cure encounter slots, schedules the L10 infected models and corpse pages, and requests warm batches. The staged startup now includes the opening regular looks and crawler at their planned tiers in the loading barrier. This can increase loading time; it has not been measured. The after traces still show 10–11 new builds at first spawn, so further cold graphs remain; a capped diagnostic on a loaded host identified seven `action:swatch` builds, a shadow material and two basic material builds. The crash machete pickup is created after the initial asset scan. A second loading change preloads the machete and warms ground swatches and pickup ring; a capped diagnostic afterward showed only two basic material builds at first spawn and an 8 ms render. A subsequent capped diagnostic located those two builds on an unnamed `Scene/Group/Group/Mesh`; a further geometry probe identified `RingGeometry`, matching the pickup marker. Matching its render order alone did not eliminate the builds. Reusing the warmed marker mesh for the first pickup eliminated them in a subsequent capped diagnostic (zero new builds at first spawn). These diagnostic timings are not quiet performance measurements; remeasurement is pending.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused L10 camera framing tests: 3 passed. The WebGL2 checkpoint trace above exercises the changed loading path.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: first execution hit the 240 s budget; unchanged rerun also timed out at 240.7 s and reported one save-progression test failure after 30.2 s before termination. A third unchanged run passed the previously failing save-progression case but again hit the 240 s budget (245.1 s), with another test failure reported before termination. A fourth unchanged run again timed out (245.6 s); the save-progression and player cases passed in that run, but the suite did not finish. A fifth unchanged run timed out at 240.9 s, with save-progression passing. The sixth unchanged run completed in 233.8 s with 1 failed, 104 passed and 1 skipped (27 files); its failure diagnostic was truncated in the captured output. The fourth run reported `tests/engine/l4-contact.test.ts` failed before its timeout. The seventh run timed out at 240.5 s; its unchanged retry completed in 219.4 s with 104 passed, 1 skipped and 1 failed: `tests/engine/l4-contact.test.ts` reports a LOW perimeter actor did not route through an available entrance. This simulation-only L4 failure is outside the L10 renderer change. After marker reuse, the remote run timed out at 241.1 s; its unchanged retry completed in 219.7 s with the same L4 contact failure (104 passed, 1 skipped). Suite is not green.
- Before → after worst frame and p99: WebGL2 high above; low baseline pending.
- Backend/tier coverage: WebGPU high, WebGL2 high, and WebGPU low traced after the fix.

## Remaining work

Remeasure the complete changes on a quiet host, confirm the reported location and trigger, then assess loading-time impact and capture a low baseline. Run focused tests and the remote unit suite, update this report with evidence, and commit the fix.
