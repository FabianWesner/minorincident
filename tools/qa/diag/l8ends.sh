#!/bin/sh
# Usage (on a runner): sh tools/qa/diag/l8ends.sh  -- unperturbed skilled-run end time for seeds 1-6 (l8carrier quiet), three at a time
seq 1 6 | xargs -P3 -I{} node --import tsx/esm tools/qa/diag/l8carrier.ts {} quiet 2>&1 | grep RESULT | sort
