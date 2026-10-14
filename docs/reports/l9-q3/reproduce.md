# Reproduce Q3

All browser commands run on the Mac, headless, after a production build. Ports below belong to this worktree and avoid 3300. Ordinary input runs use the shared browser reservation; native timing uses its exclusive quiet-run wrapper. The initial input probes were starved by repeated exclusive reservations, so the recorded matrix uses quiet-run outside e2e-lock (the inner wrapper recognizes the reservation already held).

```sh
npm run typecheck
npm run lint
npm run build
E2E_PORT=33950 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l9-browser-input.spec.ts --project=chromium --project=pixel-7 --project=pixel-7-landscape --workers=2
SCENE_PORT=33946 SCENE_SERVER=preview sh tools/perf/quiet-run.sh npm run scene:catalog -- --matrix --filter 'qa-l9-q3-*' --size 390x844 --query ui=1 --jobs 1 --backend webgl2 --out test-results/epics/E31/Q3/catalog-webgl-hud
SCENE_PORT=33945 SCENE_SERVER=preview sh tools/perf/quiet-run.sh npm run scene:catalog -- --matrix --filter 'qa-l9-q3-*' --size 390x844 --query ui=1 --jobs 1 --backend webgpu --out test-results/epics/E31/Q3/catalog-webgpu
sh tools/remote/run.sh "$PWD" -- npm run test:unit
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/sim tests/levels -t E31 --maxWorkers=2
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=33951 npm run verify -- E31
E2E_PORT=33959 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l9-dress.spec.ts tests/perf/l9-handover-budgets.spec.ts --project=chromium --workers=1
```

Existing Q1 drive/stage/ram/crawl/crash scenes are also covered with the catalog filter `qa-l9-fork-*,qa-l9-healthy-driving,qa-l9-zero-driving,qa-l9-surrounded-*,qa-l9-damage-stages,qa-l9-seam-drive,l9-crash-sequence-*,l9-crash-crawl`, both backends and the unchanged high/low × zoom matrix. Outputs use `pairs-{webgl,webgpu}` beneath `test-results/epics/E31/Q3/`.

The new static pair scenes inspect the same shared APC at the zoo departure/crossing start and matched healthy/floor fork/outskirts poses. Existing Q1 crash sheets and real-input impact/crawl/axe captures show the later pairs. The existing streaming browser fixture retains IDs and captures before/after revisit; full route and five-cycle performance remain Q4 scope. `megaHud` is the existing Scene Lab switch used to expose the HUD in the new narrow layout fixture.

The final functional batch uses all four shared BSD `lockf` reservations, then the existing `e2e-lock.sh` with `MI_E2E_LOCK_HELD=1` and `MI_E2E_UNITS_HELD=4`. This provides the same physical reservation as quiet-run without its host-load preflight, because functional assertions do not measure wall-clock budgets. Native E18 measurements continue to use `tools/perf/quiet-run.sh`. Both use a fresh build and at most two headless workers.

The final `qa-l9-q3-stream-retire` revision reuses the seam scene and adds three nearby infected to exercise lazy hero LODs and crowd matrix retirement while driving. No console, canvas, contact, or E18 gates are reduced.
