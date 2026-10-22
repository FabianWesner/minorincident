#!/bin/sh
set -eu
l10_root=$1
l10_baseline=$2
for backend in webgpu webgl2; do
  cd "$l10_baseline"
  L10_PROFILE=1 L10_BACKEND="$backend" L10_TIER=low L10_OUT="$l10_root/test-results/fixes-13h-l10/direct-get-matrix/$backend-before-low" npx tsx tools/qa/l10-real-play.ts --timing
  cd "$l10_root"
  L10_PROFILE=1 L10_BACKEND="$backend" L10_TIER=low L10_OUT="test-results/fixes-13h-l10/direct-get-matrix/$backend-after-low" npx tsx tools/qa/l10-real-play.ts --timing
done
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
for (const backend of ['webgl2', 'webgpu']) {
  const cases = ['before', 'after'].map(state => JSON.parse(readFileSync(`test-results/fixes-13h-l10/direct-get-matrix/${backend}-${state}-low/evidence.json`)));
  assert.deepEqual(cases[0].bodies, cases[1].bodies);
  assert.deepEqual(cases[0].inputs, cases[1].inputs);
  const samples = cases.map(r => r.captures.find(c => c.zoom === 1).samples.map(s => s.p95).sort((a,b) => a-b));
  console.log(JSON.stringify({backend, before: samples[0], after: samples[1]}));
  assert.ok(samples[1][1] <= samples[0][1] + .0001, `${backend}: L10 low median p95 must not get worse`);
}
JS
for backend in webgpu webgl2; do
  L10_PROFILE=1 L10_BACKEND="$backend" L10_TIER=high L10_OUT="test-results/fixes-13h-l10/direct-get-matrix/$backend-after-high" npx tsx tools/qa/l10-real-play.ts --timing
done
npm run build
L10_ENTRY_OUT=test-results/fixes-13h-l10/direct-get-entry-guard npx playwright test tests/perf/l10-entry-hitches.spec.ts --project=chromium --workers=1
