#!/bin/sh
set -eu
tar -xzf docs/reports/merge-batch13a/main-src.tar.gz
npx vitest run tests/sim/ai/director.test.ts tests/sim/levels/l10-assault.test.ts tests/sim/performance/alpha-support.test.ts tests/sim/performance/alpha.test.ts tests/sim/performance/alpha-physical.test.ts tests/sim/performance/zoo-s1.test.ts tests/sim/performance/zoo-s2.test.ts tests/sim/performance/zoo-s3.test.ts tests/sim/performance/mega-moves.test.ts tests/sim/performance/horde.test.ts tests/sim/world/chunk-residency.test.ts -t 'T-E07-11$|T-E07-11 @|T-E31-19-S4-200|T-E32-21-E3-high|T-E07-06-support-perf-200|T-E07-11-zoo-s1-200|T-E07-11-alpha-200|T-E07-11-alpha-physical-200|T-E07-11-zoo-s2-200|T-E07-11-zoo-s3-200|T-E32-11-perf-200|T-E18-02-200' --maxWorkers=1
