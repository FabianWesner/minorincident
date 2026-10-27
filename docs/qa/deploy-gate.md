# Deploy gate (PROD batches)

The orchestrator runs this on `main` before every PROD deploy (PO rules 10-07 / 10-09; long bot batteries are not part of it).

Lanes run focused tests and `npm run test:gate`; the orchestrator runs the full suite and `npm run test:nightly` once per batch. CPU test commands use `sh tools/remote/run.sh "$PWD" -- <command>` and may fall back to one admitted Mac slot when the remote pool is full. The browser/performance gates below remain coordinated local GPU/quiet-Mac work.

1. `npm run typecheck`, `npm run lint`
2. `npm run test:gate` (Hetzner: `sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh --whole-run npm run test:gate`, target ≤15 minutes of test command wall time). It runs unit, sim, per-level completion and headless QA invariant suites with at most four Vitest workers. This includes the static QA guards:
   - `tests/unit/assets/lod-fidelity.test.ts`: every static prop/building/vehicle LOD against LOD0 (extent, silhouettes, vanished materials; backlog in `lod-fidelity.baseline.json`).
   - `tests/unit/levels/decoration-surface.test.ts`: drawn decorations only on soil, every district and tier.
   - `tests/sim/world/support-seams.test.ts`: no seam in raised walkable supports, every district.
3. `npm run build`, `npm run test:smoke`
4. Scene Lab for the touched areas, **both quality tiers and both zooms**: `npm run scene:matrix` (props, seats, hand props, peds, corgi, Grove areas) plus `npm run scene:catalog -- --matrix --filter '<area>*'` for other touched areas (L9 crash site: `--filter 'l9-crash-*'`; L9 drive/damage/handover QA: `--filter 'qa-l9-*,l9-enc-*,veh-apc-*,area-l9-*'`, on both `--backend webgl2` and `webgpu`; night route read E31-AC16 / L10 R1-R6: `--matrix --filter 'night-read-*'`, nav contrast gate (typical >= 2.5, floor 2.0), see scene-lab.md "Night navigation contrast"). Open the sheets of both tiers. L10 cure-* scenes also gate `lodPlaceholderFramesMax: 0` (no placement drawn from a coarser stand-in mesh than its LOD band); `--throttle 4` slows the CPU to expose load-dependent races, and `tools/qa/lod-pop-probe.ts --walk` samples `placeholderDraws` while walking a streamed level.
5. Browser e2e (`--project=chromium --workers=2 --retries=1`, Playwright path filters are regexes on the full path, so level specs need `levels/`): `levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels` (10-14: 90 tests); for vehicle/ride changes `tests/e2e/levels/l4-bus-ride-smooth.spec.ts` (all 17 configs: both tiers, both backends, 60/120 Hz, uneven 120 Hz, 30 Hz, uneven phone cadence).

Details and the reasoning behind each guard: `docs/tools/scene-lab.md`, section "Quality x zoom matrix".

## Cleanup checkpoint (2026-10-27)

The PO has assigned a subsequent full test-suite rewrite. The scripts below are the current partition, **not a verified green release gate**: the last completed expanded gate took 16m 05.71s and failed three cases; two asset setup failures were corrected afterward, and the boss-staging expectation is superseded by Q-200. The expanded nightly was interrupted under the wrap directive. See the [failure list and measurements](tests-cleanup.md) before using this checkpoint for release approval.

## Nightly simulation layer

Run `sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh --whole-run npm run test:nightly` once nightly and before a release. Tests tagged `@nightly` are excluded from `test:gate`; the two scripts partition the same unit/sim/levels/headless-invariants inventory. Both retain Vitest's isolated timing project before functional tests. The nightly layer retains one seed-1 complete L1→L10 continuity run, including the L1→L9 axe reset and L5→L6 racks/roster checks, and the distinct newbie L1→L6 timing regression. Slow soak/diagnostic tests also belong here. Per-level ordinary-input completion remains in the gate, including a standalone L9 crossing/crash run.

Passing the simulation gate does not replace build, browser smoke, Scene Lab, render invariants or native performance checks above. See [test cleanup evidence and coverage](tests-cleanup.md) for the assertion ownership matrix and measured before/after results.


## Browser admission (2026-10-23)

`tools/e2e-lock.sh`, direct Scene Lab clients, and Playwright start/discover the local browser pool automatically. The pool runs **one GPU/Metal Chrome**, shared by WebGL2 and WebGPU, with **N=4 functional contexts**; SwiftShader is a separate optional process capped at two contexts. Playwright remains headless and limited to two workers per command. Use distinct private `E2E_PORT`/`SCENE_PORT` values; this pool's service and measurement tools use ports 4321–4329, never 3300. These limits are based on the fixed-set [pool measurements](../reports/browser-pool/README.md), with large-mission capacity explicitly unproven.

Each test/spec/capture group has its own context and storage. Scene Lab CLI/catalog, QA A/B, playtests, and the Mac invariant runner use the pool. Playtest profiles have portable storage per profile, and live sessions release after 60 seconds without input/capture even if monitoring/autofight continues. An inactive context closes after 60 seconds without a client action; in-flight actions can finish. Idle Chrome processes close after another 60 seconds, releasing all legacy browser locks. The daemon can remain running. A client losing the pool after admission fails safely instead of starting an unguarded GPU process.

The daemon reserves legacy slots 0–3 before launching Chrome, samples WindowServer CPU over ten seconds, and backs shared admission off above 60%. Three consecutive samples below 30% restore one context; a missing/invalid sample reduces capacity to one. A fresh GPU launch also uses the existing guard with a one-GPU-root cap. Unmigrated callers keep using the legacy locks and can run when idle Chrome releases them. When the pool is down, wrappers retain the existing guarded launch path and 30-minute admission deadline. During a coordinated one-GPU fallback window, use one Playwright worker and reserve both legacy units; do not run another GPU lane concurrently.

Native timing and uncapped probes use `tools/perf/quiet-run.sh` directly. It starts the pool when needed, requests exclusive admission, blocks new shared steps, and waits for current contexts to close or expire. It retains load < 3, no foreign headless Chrome, no local Vitest/Blender/build, the one-minute cooldown and 30-minute admission deadline; the held command is capped at 10 minutes including cleanup. Native channel/launch flags can restart Chrome after draining; Playwright fixtures reconnect per test context. Set `E2E_LEGACY=1` only for a command that must use legacy admission. Report unmeasured timing whenever quiet admission is unavailable.

The orchestrator's existing `npm run scene:matrix` filter, WebGPU coverage and `E2E_UNITS=2` declaration stay valid: pooled admission counts contexts, and the declaration remains useful in fallback. See [pool operation and lifecycle validation](../../tools/browser-pool/README.md).

Hetzner handles CPU work (unit, levels and sim, at most four Vitest workers). Browser runs there are opt-in: `npm run scene:matrix:remote` uses WebGL2/SwiftShader with the same scene filter; `npm run test:e2e:remote` uses one worker and excludes WebGPU, `@perf` and `@gpu` titles. Remote scene artifacts are copied back even on failed row gates; select a distinct `--out` directory when comparing backends. Software-rendered runs are unsuitable as the deploy gate or native timing evidence. The attempted full remote matrix was stopped after 13/1,026 rows in about 50 minutes. See the [final report](../reports/gpu-offload/README.md).
