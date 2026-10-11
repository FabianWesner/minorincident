Weather Live fixtures use E28's sim timeline; no player weather control is added.
L1: clouds form from 45–85 s. L3: ash enters the haze from 90–135 s.
L5: ground fog gathers from 60–120 s while the existing ash continues.
Capture: SCENE_PORT=3357 sh tools/e2e-lock.sh npx tsx tools/scenelab/cli.ts tools/weather-live/L1.json tools/weather-live/L3.json tools/weather-live/L5.json tools/weather-live/rain.json --out test-results/weather-live/scenes
Frame budgets: E2E_PORT=3378 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/weather-live.spec.ts --project=chromium --workers=1
Simulation: sh tools/remote/run.sh "$PWD" -- npx vitest run tests/sim/weather.test.ts --maxWorkers=4
Rain is a developer fixture using the same blend path; campaign weather stays authored by each level.
L3 stall control: prefix the performance command with WEATHER_CONTROL=1 and --grep "L3 high" to hold the original haze. WEATHER_CPU_PROFILE=1 saves a Chrome CPU profile.
