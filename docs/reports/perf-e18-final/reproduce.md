# Outstanding checks (Mac, headless, fresh build)

Ports 3517/3518 are this lane's ports. Preserve the normal browser locks, one timing worker and a reservation no longer than 20 minutes. Release between timing batches; do not repeat the lane's exhausted slot wait.

```sh
npm run build
SCENE_SERVER=preview SCENE_PORT=3518 E2E_UNITS=2 npm run scene:matrix
SCENE_SERVER=preview SCENE_PORT=3518 E2E_UNITS=2 npm run scene:catalog -- --matrix --backend webgl2 --filter 'e18-*' --out docs/reports/perf-e18-final/after/webgl
SCENE_SERVER=preview SCENE_PORT=3518 E2E_UNITS=2 npm run scene:catalog -- --matrix --backend webgpu --filter 'e18-*' --out docs/reports/perf-e18-final/after/webgpu
```

The existing authored phone proxy is 390×844 Pixel 7 touch, 4× CDP CPU throttle and DPR 1.5. No population/scenario/budget change is needed. In a separately admitted, bounded quiet batch:

```sh
E2E_PORT=3517 PHONE_PERF=1 L4_CPU_PROFILE=1 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts tests/perf/l4-budgets.spec.ts --project=chromium --workers=1 --grep 'rescue peak.*low|Boulevard phone|line break low'
```

That is diagnostic L4 profiling, not the final acceptance timing; rerun without `L4_CPU_PROFILE` in a separate quiet batch after any measured fix. CPU phases retain timestamps, per-tick/frame sim time and presentation/render time.

A separate bounded batch for the corrected L6 phone recorder:

```sh
E2E_PORT=3517 E18_WEBGPU_PROXY=1 sh tools/perf/quiet-run.sh npx playwright test tests/perf/e18-devices.spec.ts --project=chromium --workers=1
```

WebGPU is an explicit opt-in headless native proxy. Physical iOS/Android acceptance remains manual. Also rerun final E18 memory/counters (including the added male-skin case), smoke, the deploy-browser selection in `docs/qa/deploy-gate.md`, and E18 verification with all heavy Node work on Hetzner. The stock E18 verify wrapper still schedules local Vitest timing and unbounded browser phases, so do not use it unchanged against this task's runner/fairness constraints.

## Node checks (Hetzner only)

```sh
sh tools/remote/run.sh "$PWD" --pull docs/reports/perf-e18-final/full-node.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=docs/reports/perf-e18-final/full-node.json
sh tools/remote/run.sh "$PWD" --pull docs/reports/perf-e18-final/unit-final.json -- npx vitest run tests/unit --maxWorkers=4 --reporter=default --reporter=json --outputFile=docs/reports/perf-e18-final/unit-final.json
```

The initial combined run predates the low-skin asset changes; the complete final unit run validates those changes. Simulation implementation is identical throughout; later fixture corrections restore the original L1 setup order, preserve the original L5 player pose and use L6’s authored start. The eight L5/L6 fixture regressions pass on the final setup.

## Rebuild the derived low skins

```sh
npx tsx tools/assets/courier-skin-lod.ts
```

This reads the shipped `.skin.glb` files and writes the `.skin.low.glb` files; the final unit suite checks the serialized rebuild against both committed outputs.
