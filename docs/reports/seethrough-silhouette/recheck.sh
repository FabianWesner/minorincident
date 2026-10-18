#!/bin/sh
# Run on Hetzner through timing-isolated.sh; preserve every original assertion and timeout.
npm run sim -- --scenario perf-horde-200 --out docs/reports/seethrough-silhouette/e18-isolated-200.json
npm run sim -- --scenario perf-horde-100 --out docs/reports/seethrough-silhouette/e18-isolated-100.json
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
for (const [count, limit] of [[200, 4], [100, 6]]) {
  const d = JSON.parse(readFileSync(`docs/reports/seethrough-silhouette/e18-isolated-${count}.json`, 'utf8'));
  assert.equal(d.minInfected, count); assert.ok(d.simMsP95 <= limit, `${count}: ${d.simMsP95} > ${limit}`);
}
JS
p=$?
npx vitest run tests/unit/assets/validate.test.ts tests/unit/render/vehicle-occlusion.test.ts tests/unit/render/seethrough.test.ts tests/unit/tooling/seethrough-probe.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=docs/reports/seethrough-silhouette/rechecked-unit.json
u=$?
npx vitest run tests/sim/performance tests/sim/levels/l10-assault.test.ts tests/sim/world/chunk-residency.test.ts tests/sim/l9-campaign-continuity.test.ts tests/sim/combat/l5-shotgun.test.ts tests/sim/levels/l10-campus-corridor.test.ts tests/sim/world/solid-registry.test.ts -t 'T-E32-21-E3-high|T-E31-19-S4-200|T-E31-20-L1-prop|T-E23-12-kill|T-E32-03-D3-high|collision natural L4|@E18' --maxWorkers=1 --reporter=default --reporter=json --outputFile=docs/reports/seethrough-silhouette/rechecked-sim.json
s=$?
printf 'RECHECK_EXIT perf=%s unit=%s sim=%s\n' "$p" "$u" "$s"
test "$p$u$s" = 000
