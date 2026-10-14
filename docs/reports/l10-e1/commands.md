# L10-E1 validation recipe

All browser commands are headless; private ports are 34171 (E2E) and 34172 (encounters) and 34173 (medkit Scene Lab). The scene runner requests one browser unit and one job, through the shared lock. The final quality matrix currently includes the additional far zoom 1.5 as well as the required 1/0.5.

```sh
npm run typecheck
npm run lint
sh tools/remote/run.sh "$PWD" -- npm run test:unit -- --maxWorkers=4
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E32/E1/sim.json --pull test-results/epics/E32/D2 -- npx vitest run -t '@E32' --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E32/E1/sim.json
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E32/mega-moves-perf-200.json -- npx vitest run tests/sim/performance/mega-moves.test.ts --maxWorkers=1
E2E_PORT=34171 MI_VERIFY_REMOTE_SIM=1 npm run verify -- E32
SCENE_PORT=34172 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh sh -c 'npm run build && npx tsx tools/scenelab/catalog.ts --matrix --filter "l10-e1-*" --backend webgl2 --jobs 1 --out test-results/epics/E32/E1/webgl2 && npx tsx tools/scenelab/catalog.ts --matrix --filter "l10-e1-*" --backend webgpu --jobs 1 --out test-results/epics/E32/E1/webgpu'
```

Run build/scene capture and verify sequentially within this worktree: both use `dist/`. The verify runner itself wraps native timing in `tools/perf/quiet-run.sh` and browser work in `tools/e2e-lock.sh`.
