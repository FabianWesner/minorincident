# Tracer review — 2026-10-13

The PO reference was opened: four parallel rows of white particles remain across the ground and read as markings. The replacement uses one 1 m × 0.065 m warm additive quad at 320 m/s, in the existing instanced particle draw. NPCs show rounds 1, 4, 7, etc.; every player round emits a streak. The player ray stops at its first predicted victim or cover. Ordinary gun projectile spheres are hidden; muzzle flash, brass, miss dust and rocket/throwable bodies retain their existing presentation.

## Captures inspected

The initial run completed all 24 cases: WebGL2 and WebGPU × high and low × zoom 0.5, 1 and 1.5 × four-soldier rifle bursts and courier army MG. All 24 contact sheets were opened, together with adjacent full-size close-up PNGs and the wide squad PNG. The runner asserts the actual backend (including a WebGL2 context check), 320 m/s motion, hit clipping, streak dimensions, particle caps, frame pixels and draw/triangle budgets. Each case retains a normal 60 Hz sequence and a 240 Hz sample of the first real shot with simulation frozen, played at 60 fps for four-times-slower review.

| Check | Result | Observation |
| --- | --- | --- |
| One short warm streak, no dashed ray | PASS | The squad has four isolated gold strokes, one for each selected round, with clear ground between muzzle and stroke. |
| Motion and fade | PASS | Normal squad frames 3–5 move the strokes across the camera; frame 6 has no tracer. Courier subframes move one stroke away from the muzzle until it exits the view. |
| High/low and three zooms | PASS | All initial sheets show the same shape and warm color. Close squad views have off-screen shooters; the strokes cross the visible ground. Wide views show guards and the Alpha. |
| Player and infected readability | PASS | The courier's hat and teal backpack remain clear. The wide squad's Alpha is visible at the right; its brief white hit flash is existing feedback. |
| Muzzle/brass/dust preservation | PASS | Muzzle glows persist after the streak passes, with small casing/dust particles in the squad sequences. No orange MG projectile sphere remains. |
| Pools/draws | PASS | Initial fixture peaks: 382 active particles high and 105 low, below 2048/512; at most 21 draws and 70,217 triangles. No new mesh, pool, geometry or per-instance attribute. |
| Final launch-phase check | PENDING | These initial images precede the final 8.3 ms launch phase. That adjustment keeps the first advancing 60 Hz close-zoom player frame inside the viewport. Unit tests pass; its repeat capture was never admitted behind exclusive performance jobs and was stopped at the 90-minute job budget. |

Representative initial sequences: [WebGL squad](captures/initial-webgl-squad.jpg), [WebGPU low courier](captures/initial-webgpu-courier.jpg). Full PNGs, WebMs and GPU slot probes are under `test-results/tracers/<backend>-<tier>-z<zoom>-<scene>/`. The images named `initial-*` explicitly retain the pre-launch-phase timing; they are not represented as final timing captures.

## Validation and controls

- Final typecheck, lint and production build pass. Focused VFX/gun-pose: **43/43** on Hetzner, including independent cadence, hit/cover clipping, disable/reset, pooled counts and an MG simulation hash with VFX on/off.
- Full unit run: **1313 passed, 1 failed, 7 skipped**. The unchanged `b94761e2` control reproduces the identical camera test failure: radius 20.722057845759174, expected 19 (`rack-selection.test.ts:21`). No camera or test criterion was changed.
- Initial `scene:matrix`: **142/146**. Corgi behaviour has 14 cm foot slide versus the 8 cm gate at zoom 1.5, high and low. Two additional low cases were interrupted by a source hot reload during the sweep; the fixed-production rerun was never admitted and was stopped at the time budget. The unchanged-revision corgi control was never admitted either, so the corgi failure is not yet labelled baseline-confirmed.
- L4 native high/low: draw/triangle budgets hold (**322 / 1,034,612 high; 236 / 484,480 low**), war p95 **10.8 / 33 ms**. Low passes. High fails the soldier-death assertion (20/20 alive at the 84 s sample); unchanged HEAD reproduces 20/20 with exactly the same draws/triangles. Its line-break hitch is **54.4 ms with tracers versus 55 ms on unchanged HEAD**, both above the 50 ms gate. These measurements preceded the player-hit and launch-phase refinements.
- Remote `test:smoke`: Node **6/6**; browser **22/31**, with Linux timing and unavailable/dropped WebGPU failures. The native Mac smoke run and E15 browser verification were never admitted and were stopped at the time budget. E15 remote selection passed **21/21**. Neither complete smoke nor complete E15 verification is claimed green.

Control data: `test-results/tracers/baseline-unit.json`, `test-results/tracers/perf/baseline-high.json`; final focused data: `test-results/tracers/focused-final.json`. Replay commands and fixture details are in [README.md](README.md). No specs or acceptance thresholds were changed.

All five owned queued browser checks were terminated by their verified worktree/process ancestry; other lanes and shared servers were left running. Core fix: `1ed93285`. The final 8.3 ms timing refinement has passing unit/static checks but remains pending GPU capture; the initial visual review above must not be used to claim the final timing refinement or all regression gates complete.
