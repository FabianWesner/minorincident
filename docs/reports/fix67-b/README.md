# fix67-b — L4–L6 measured failures

Work is in progress. The L6-12 collision counterexample is fixed, and the L4-10 and L4-11 measured combat defects are fixed at the native-measurement level. Their compound acceptance rows remain open where current-source visual or taste clauses are not yet qualified.

## Completed row work

| Row | Current result | Commits / evidence |
| --- | --- | --- |
| L6-12 | At both qualities, an open Northgate crosses and its closed raised gate blocks the production Rapier capsule. The complete row remains open for current-source end-shot and result review. | `9d252a4`; `docs/reports/sweep-b/L6-northgate.json`, `docs/reports/sweep-b/L6-12-proof.json` |
| L6-11 | Fresh low/high ordinary mortal runs still fail the 60% target: complete saves1/29 (3.45%) at both tiers. Evade-only times out at600 s with13 courier deaths, so no result rate is inferred. | `b255570`; `docs/reports/sweep-b/L6-11-protection.json` |
| L4-10 | The fuel truck moved to x34,z−9.5. Both complete-route hashes match current canonical receipts; all ordinary and forced impacts clear registered living actors by at least15m (low forced21.19m, high18.95m). Ordinary cadence remains8–12s. The full row stays open for renderer review. | `c9b7527`, `6093eb3`; `docs/reports/sweep-b/L4-10-clearance-recheck.json`, `docs/reports/sweep-b/L4-tank-clearance.json.gz` |
| L4-11 | Army MG spread is2° and riot shield strain breaks at80. The low/high full-health courier duels finish in4.70s or less from1.6–26m; the courier survives all cases. Flank timing, rendered chip/recoil/bar review, and PO feel remain open. | `2b0024d`, `feedf7b`; `docs/reports/sweep-b/L4-11-recheck.json`, `docs/reports/sweep-b/L4-riot-duels.json` |

## Still open

- L6-12 full end-shot/result clauses; L6-11 60% outcome target.
- L4-10 current-source renderer review; L4-11 flank, bar/chip/recoil, and PO feel review.
- L4-13, L4-05, L4-06, L4-07, L5-12, L6-01, L6-06, L4-17, L4-12, L4-16, and L6-14 have not yet been requalified in this lane.
- Final current-source `qa:accept` for L4–L6, `npx tsc --noEmit`, `npm run lint`, `npm test`, and standalone `npm run qa:threat` remain pending.

## Capture limitation

The current-source Scene Lab capture attempt failed because local Vite could not bind (`listen EPERM` on port3341). No new captures were produced. Existing screenshots were not used to claim that the relocated fuel truck or updated riot behavior looks correct. Retry those visual checks when local browser-server access is available; the browser workflow remains headless and uses the shared pool.
