#!/bin/sh
set -eu
l10_root=$1
cd "$2"
npm run build
set +e
L10_ENTRY_OUT="$l10_root/test-results/fixes-13h-l10/production-entry-before" npx playwright test tests/perf/l10-entry-hitches.spec.ts --project=chromium --grep webgpu --workers=1
l10_status=$?
set -e
[ "$l10_status" -eq 1 ]
node --input-type=module - "$l10_root" <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
for (const backend of ['webgpu']) for(const entry of ['debug','continue']) {
 const r=JSON.parse(fs.readFileSync(`${process.argv[2]}/test-results/fixes-13h-l10/production-entry-before/${entry}-${backend}.json`));
 assert.ok(r.state.transform.x>800); assert.ok(r.playableFrames>100);
 console.log(JSON.stringify({backend,entry,max:r.max,p95:r.p95,load:r.load}));
}
JS
