# s218 — L4–L9 solid props (in progress)

The generated campaign-layout audit found no offenders in L4, L5, L8, or L9. L6 and L7 each have one remaining substantial placement: the Northgate `int.metro-exit`. It is a solid interactive building with a swinging gate used by the night-exit handover. The static placement collider is absent. Treating the whole footprint as solid would close the authored route when the gate opens, so the remaining fix needs a shell collider that keeps the gate passage usable and a route regression check.

## Generated campaign layout counts

| Level | District | Placements | Eligible | Before | After |
| --- | --- | ---: | ---: | ---: | ---: |
| L4 | D-FAIR | 835 | 779 | 0 | 0 |
| L5 | D-FAIR | 889 | 757 | 0 | 0 |
| L6 | D-SUBWAY | 91 | 61 | 1 | 1 |
| L7 | D-FAIR | 937 | 783 | 1 | 1 |
| L8 | D-ZOO | 2,349 | 1,901 | 0 | 0 |
| L9 | D-CROSSING | 3,385 | 3,097 | 0 | 0 |

The audit uses the s211c threshold (footprint ≥ 0.4 m² and height ≥ 0.5 m) and requires a non-physics-only collider at every active tier (0–6). It measures collider coverage, not visual hull fidelity or physical movement contacts. Machine-readable counts are in [audit.json](audit.json).

## Verification

- Generated-layout audit: L4/L5/L8/L9 zero; L6/L7 each one (same dynamic Northgate exit).
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused collision/world systems tests — 9 passed.
- `npm test` — 27 files, 106 passed, 122.5 s / 240 s budget.
- Two-shard full threat audit ran locally after the remote runners were unavailable. With the attempted Northgate side-wall collision, all skilled routes completed but the merge reported `L7/step/departure:SLOW_FOLLOWER:107`. The attempted change was reverted under the zero-flag rule. Receipt: `test-results/s218-threat/audit.json`. The reverted state has not been re-audited.

This report records the baseline and open work; it does not claim the L4–L9 objective is complete. The side-wall attempt was committed as `af9bbae4` and reverted as `8c3857c7` after the threat flag.
