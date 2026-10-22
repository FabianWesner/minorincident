# P1-107 scene-loading investigation — work in progress

- Requested base branches integrated; baseline runtime `9698a393c`, source/build identity in `evidence/before-build.json`.
- No runtime fix is verified yet. Quiet unprofiled L1 WebGPU low/high baselines now have 20 samples each (median/max 2.459/2.561 s and 2.485/2.593 s).
- L1: 25 low WebGPU traces max 2.872 s; 20 low WebGL2 traces max 3.759 s. Five high traces per backend max 2.724 / 2.981 s. The original 10–16 s L1 stall has not recurred.
- Later-level single samples: L7 low WebGPU/WebGL2 6.482/6.065 s; L10 8.981–9.466 s across four configurations. These do not establish quiet-run budget failures.
- L10 low profile: ~4.8 s scene assembly (crowd baking/geometry), then ~2.7 s TSL generation; see `evidence/L10-low-{assembly,shaders}.txt` and retained raw profile/trace.
- The quiet L1 WebGL2 baseline batch is running. L8 (reported 23–25 s) was added; 20-configuration before/after distributions and candidate gameplay checks remain outstanding.
- The asynchronous foreground WebGPU experiment passes 18 targeted remote warm-up unit tests; baseline unit/level suite is running; final remote suite, smoke, gameplay-frame checks and the L10 #100 replay remain outstanding.
- `tools/perf/cold-load-time.ts` records fresh-profile samples, optional traces and the load/frame/median gate; the budget is specified in `docs/qa/regression-gate.md`.
