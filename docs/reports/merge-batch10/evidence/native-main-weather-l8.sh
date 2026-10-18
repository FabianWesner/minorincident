#!/bin/sh
if ! /usr/bin/id -un >/dev/null 2>&1 || ! /bin/ps -p "$$" >/dev/null 2>&1; then
  printf '%s\n' 'Host identity/process services are unavailable; native measurements are unmeasured.' >&2
  exit 125
fi
mkdir -p docs/reports/merge-batch10/perf/main-weather docs/reports/merge-batch10/perf/l8-final
E2E_PORT=3485 VFX_DIST="$PWD/test-results/merge-batch10/main-weather-dist" npx playwright test --config tools/scenelab/vfx-stunning.config.ts tests/perf/weather.spec.ts --grep T-E28-10-frame --project=chromium --workers=1
weather_rc=$?
cp test-results/epics/E28/perf/storm-native-*.json docs/reports/merge-batch10/perf/main-weather/
cp tools/scenelab/test-results/vfx-stunning/browser-3485.json docs/reports/merge-batch10/perf/main-weather/playwright.json
E2E_PORT=3486 VFX_DIST="$PWD/test-results/merge-batch10/gate-stage-dist" npx playwright test --config tools/scenelab/vfx-stunning.config.ts tests/perf/l8-budgets.spec.ts --project=chromium --workers=1
l8_rc=$?
cp test-results/epics/E30/perf-*.json docs/reports/merge-batch10/perf/l8-final/
cp tools/scenelab/test-results/vfx-stunning/browser-3486.json docs/reports/merge-batch10/perf/l8-final/playwright.json
printf 'weather=%s l8=%s\n' "$weather_rc" "$l8_rc"
[ "$weather_rc" -eq 0 ] && [ "$l8_rc" -eq 0 ]
