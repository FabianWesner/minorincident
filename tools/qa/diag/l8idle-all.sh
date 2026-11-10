#!/bin/sh
# Usage (on a runner): sh tools/qa/diag/l8idle-all.sh  -- unperturbed end time (l8carrier) and idle (l8idle) for seeds 1-6, three at a time
seq 1 6 | xargs -P3 -I{} node --import tsx/esm tools/qa/diag/l8idle.ts {} 2>&1 | grep RESULT | sort
seq 1 6 | xargs -P3 -I{} node --import tsx/esm tools/qa/diag/l8carrier.ts {} quiet 2>&1 | grep RESULT | sort
