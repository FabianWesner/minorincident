#!/bin/sh
set -eu
l10_root=$1
cd "$l10_root"
for l10_mode in normal drained; do
  l10_drain=0
  [ "$l10_mode" != drained ] || l10_drain=1
  L10_ASSAULT_PROFILE=1 L10_DRAIN_BEFORE_ASSAULT="$l10_drain" L10_BACKEND=webgpu L10_TIER=low L10_OUT="test-results/fixes-13h-l10/warm-diagnostics/$l10_mode" npx tsx tools/qa/l10-real-play.ts --timing --real-time
done
node --input-type=module - <<'JS'
import fs from 'node:fs';
const [normal, drained] = ['normal', 'drained'].map(s => JSON.parse(fs.readFileSync(`test-results/fixes-13h-l10/warm-diagnostics/${s}/evidence.json`)));
const summary = { normal: normal.nativePerformance, drained: drained.nativePerformance, exact: Object.fromEntries(['inputs','kills','bodies'].map(k => [k, JSON.stringify(normal[k]) === JSON.stringify(drained[k])])) };
fs.writeFileSync('test-results/fixes-13h-l10/warm-diagnostics/summary.json', JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
JS
printf '%s\n' 'Warm diagnostics complete; starting matching WebGL2 production baselines.'
cd "$2"
npm run build
set +e
L10_ENTRY_OUT="$l10_root/test-results/fixes-13h-l10/production-entry-before" npx playwright test tests/perf/l10-entry-hitches.spec.ts --project=chromium --grep webgl2 --workers=1
l10_status=$?
set -e
[ "$l10_status" -eq 1 ]
node --input-type=module - "$l10_root" <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
for (const backend of ['webgl2']) for(const entry of ['debug','continue']) {
 const r=JSON.parse(fs.readFileSync(`${process.argv[2]}/test-results/fixes-13h-l10/production-entry-before/${entry}-${backend}.json`));
 assert.ok(r.state.transform.x>800); assert.ok(r.playableFrames>100);
 console.log(JSON.stringify({backend,entry,max:r.max,p95:r.p95,load:r.load}));
}
JS
