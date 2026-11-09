#!/usr/bin/env bash
set -uo pipefail
git add --renormalize .
git -c user.name=Runner -c user.email=runner@local commit -qm snapshot
export VITEST_MAX_WORKERS="${VITEST_MAX_WORKERS:-2}"
mkdir -p test-results/r17-l7escort-verify-final
node --import tsx/esm --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { provenance } from './tools/qa/accept/probe.ts';
writeFileSync('test-results/r17-l7escort-verify-final/identity.json', JSON.stringify({ ...provenance(), maxWorkers: Number(process.env.VITEST_MAX_WORKERS) }, null, 2) + String.fromCharCode(10));
JS
npm run verify -- E29 2>&1 | tee test-results/r17-l7escort-verify-final/verify.log
result=${PIPESTATUS[0]}
cp test-results/epics/E29/checks.json test-results/r17-l7escort-verify-final/checks.json
exit "$result"
