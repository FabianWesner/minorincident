# Deploy gate (PROD batches)

The orchestrator runs this on `main` before every PROD deploy (PO rules 10-07 / 10-09; long bot batteries are not part of it).

1. `npm run typecheck`, `npm run lint`
2. `npm run test:unit` (Hetzner: `sh tools/remote/run.sh $PWD -- npm run test:unit`). Since 2026-10-13 it includes the static QA guards:
   - `tests/unit/assets/lod-fidelity.test.ts`: every static prop/building/vehicle LOD against LOD0 (extent, silhouettes, vanished materials; backlog in `lod-fidelity.baseline.json`).
   - `tests/unit/levels/decoration-surface.test.ts`: drawn decorations only on soil, every district and tier.
   - `tests/sim/world/support-seams.test.ts`: no seam in raised walkable supports, every district.
3. `npm run build`, `npm run test:smoke`
4. Scene Lab for the touched areas, **both quality tiers and both zooms**: `npm run scene:matrix` (props, seats, hand props, peds, corgi, Grove areas) plus `npm run scene:catalog -- --matrix --filter '<area>*'` for other touched areas (L9 crash site: `--filter 'l9-crash-*'`; L9 drive/damage/handover QA: `--filter 'qa-l9-*,l9-enc-*,veh-apc-*,area-l9-*'`, on both `--backend webgl2` and `webgpu`; night route read E31-AC16 / L10 R1-R6: `--matrix --filter 'night-read-*'`, nav contrast gate (typical >= 2.5, floor 2.0), see scene-lab.md "Night navigation contrast"). Open the sheets of both tiers. L10 cure-* scenes also gate `lodPlaceholderFramesMax: 0` (no placement drawn from a coarser stand-in mesh than its LOD band); `--throttle 4` slows the CPU to expose load-dependent races, and `tools/qa/lod-pop-probe.ts --walk` samples `placeholderDraws` while walking a streamed level.
5. Browser e2e (`--project=chromium --workers=2 --retries=1`, Playwright path filters are regexes on the full path, so level specs need `levels/`): `levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels` (10-14: 90 tests); for vehicle/ride changes `tests/e2e/levels/l4-bus-ride-smooth.spec.ts` (all 17 configs: both tiers, both backends, 60/120 Hz, uneven 120 Hz, 30 Hz, uneven phone cadence).

Details and the reasoning behind each guard: `docs/tools/scene-lab.md`, section "Quality x zoom matrix".


## Browser admission (2026-10-18)

The orchestrator gate `epics-pipeline/gate-browser.sh` runs browser checks locally with `E2E_SLOTS=2`. `npm run scene:matrix` uses the existing filter, WebGPU and `E2E_UNITS=2`; `npm run test:e2e` and `npm run scene:catalog` use `tools/e2e-lock.sh` locally. Browser automation stays headless, with at most two GPU browsers across lanes. Use unique `E2E_PORT`/`SCENE_PORT` values, never 3300.

`tools/e2e-lock.sh` hard-caps Mac capacity at two even if `E2E_SLOTS` is larger. Before admission, `tools/mac-gpu-guard.py` samples WindowServer CPU time over ten seconds and waits above 60%, on a missing/restarted sample, or when existing headless browser roots plus requested capacity exceed two. GPU/renderer subprocesses do not count as browsers. Admission stops after 30 minutes. All active worktrees must use these wrappers for the shared protection to apply; admission cannot guarantee that macOS will never hang.

Uncapped probes and native verifier timing phases use `tools/perf/quiet-run.sh`. It releases partial reservations during contention, reserves all legacy slots, bounds each held batch to 20 minutes including owned-descendant cleanup, and enforces a shared one-minute cooldown. Admission stops after 30 minutes; report any remaining coverage as unmeasured.

Hetzner handles CPU work (unit, levels and sim, at most four Vitest workers). Browser runs there are opt-in: `npm run scene:matrix:remote` uses WebGL2/SwiftShader with the same scene filter; `npm run test:e2e:remote` uses one worker and excludes WebGPU, `@perf` and `@gpu` titles. Remote scene artifacts are copied back even on failed row gates; select a distinct `--out` directory when comparing backends. Software-rendered runs are unsuitable as the deploy gate or native timing evidence. The attempted full remote matrix was stopped after 13/1,026 rows in about 50 minutes. See the [final report](../reports/gpu-offload/README.md).
