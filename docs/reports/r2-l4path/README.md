# r2-l4path: L4-07 low bounded reachability

## Cause

The regression begins in `1e75cad` (`Clear L4 plaza route by moving trash bin`). The D-FAIR trash bin at `(-24, -19.2)` was shifted 3.4 m west to clear one continuous body-clear route. On that commit, the unchanged low complete acceptance route measured **85.48%** bounded-path reachability (53/62 nearby at hold tick 13249). Its parent `d2090ab` measured **100%** (26/26 at its worst hold sample). The later wreck, corpse, and L4/L5 merges were not needed to reproduce the regression.

The failing current-source sample has courier position `(-7.8001, 2.5999)` and blocked IDs `430,451,478,495,509,513,514,521,529`. Representative positions are actor 451 at `(-13.68,-0.41)`, actor 509 at `(-13.71,5.03)`, and actor 430 at `(-16.55,19.25)`. The parent/commit comparison isolates the bin relocation as the trigger; the inferred mechanism is its effect on subsequent hold traffic. It does not prove the bin directly obstructed every listed actor.

## Fix

Keep the bin's original Z position and move it only 1.0 m west, to `(-25, -19.2)`. This retains the relocation intended to clear the original sprinter and passes the bounded-path floor on the current low route. Only the placement and its matching visual/collision bounds move.

## Verification

- `npm run qa:accept -- --level L4 --tier low --skip-browser` — **exit 1**, 0 fresh failing rows and 18 incomplete rows; this command does not close the full acceptance report. Low complete bounded-path minimum **91.43%** (32/35, tick 12289); low stationary **98.65%**. The post-opening legal-path ledger is **92.54%** minimum in complete and 100% stationary.
- `npm run qa:threat -- --levels L4 --out test-results/r2-l4path/threat-final` — **L4 skilled and passive flags: 0**; passive reachability is 100%. The command exits 1 because selecting only L4 is reported as `PARTIAL_LEVEL_SELECTION`, not because L4 has a threat flag. The audit records the high-tier hold census as complete.

Typecheck and lint passed in `npm run verify -- E22`. Its four-worker unit stage timed out in `l4-contact` at the unchanged 30 s timeout (106 tests passed). `npm run test:unit -- -- --maxWorkers=1` then passed all **107 tests / 27 files**, with the original timeout and budget. The verifier therefore remains red; no full-verifier PASS is claimed.

[Raw receipts and validation logs](evidence/) retain the final source hash, clause values and L4 flags. Acceptance receipts are gzip-compressed losslessly. The single temporary candidate checkout was removed.

The numeric low-tier objective is the scope of this fix. The separate every-infected legal-path clause remains unproven; the full L4-07 row is not claimed closed. No target or threshold changed. No deploy or push.
