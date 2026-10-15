# Historical Astra validation

The Sol continuation supersedes the visual pending status below: both final matrices pass 18/18 with inspected game-camera sheets; see [sol-review.md](sol-review.md). Current phone timing remains unmeasured after the browser fairness cutoff, with admission accounting in `sol-browser-admission.json`. Current checks and final remote counts are recorded in [continuation.md](continuation.md).

- `npm run build`, `npm run typecheck`, `npm run lint`: pass for the pose-texture source change.
- Remote full suite: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`, renderer snapshot 97345172, 428 files: 422 pass, 3 fail, 3 skip; 2809 tests: 2797 pass, 3 fail, 9 skip; 2660.75 seconds. See remote-suite.txt for exact failures. The source snapshot includes the initial-camera test subsequently removed with its unrelated behavior.
- Remote focused camera/weather regression: 9/9 pass before removing the inherited paused-camera test; tests cover cached placement transform invalidation, 100 camera-ray equivalence cases, weather footprints and byte-identical sparse uploads.
- Remote focused pose/civilian/texture upload regression: 8/8 pass; expanded pose test also passes 2/2 with Three's actual NodeSampledTexture rebinding. See pose-texture-tests.txt and pose-binding-tests.txt.
- L3 newbie failure independently reproduced remotely: 5 deaths versus the <=2 gate. See l3-newbie.txt. No simulation source is changed in this branch.
- E18 node horde timing and the other nonbrowser performance guards pass in the full remote suite. The existing L3 high quiet benchmark passes frame/simulation/draw/triangle/actor/fallback gates. The camera/weather-only phone defence still fails; latest pose source requires its own acceptance run.
- Final three-scene WebGL2/WebGPU matrix and latest phone/high timings remain unmeasured after the required 30-minute browser-queue stop. Initial matrix evidence is retained with explicit initial labels; it is not acceptance for the later pose change.
- The full deploy gate, real phone hardware and manual interactive WebGPU are not claimed. All browser work here is headless; this lane neither deploys nor merges.

## Remaining acceptance in an available browser window

The current production build contains cf2ae8b2 source (later commits add tests/reports). Start with a fresh `npm run build`, then:

```sh
SCENE_PORT=3474 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --filter 'l3-p95-*,l3-blvd-footprint-cache' --backend webgl2 --jobs 1 --out test-results/astra-l3-p95/final-webgl2
SCENE_PORT=3474 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --filter 'l3-p95-*,l3-blvd-footprint-cache' --backend webgpu --jobs 1 --out test-results/astra-l3-p95/final-webgpu
E2E_PORT=3473 sh tools/e2e-lock.sh npx playwright test tests/e2e/crowd.spec.ts --project=chromium --workers=1
E2E_PORT=3473 PERF_CONDITIONS_LOG=/tmp/astra-l3-p95-pose-conditions.jsonl sh tools/perf/quiet-run.sh npx playwright test tests/perf/l3-budgets.spec.ts --project=chromium --workers=1 --grep 'high|phone'
```

Enforce the 20-minute quiet reservation and 30-minute queue limits externally, as in this lane's completed runs. Release between timing batches. Inspect final game-camera sheets and compare camera/ash to baseline-sheets; obtain a baseline pose-texture scene with the unchanged baseline renderer if differences need diagnosis. Keep the three existing gameplay failures separate from this rendering lane. The final report must replace the blocked status only after measured acceptance.
