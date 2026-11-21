# s218 — L4–L9 solid props (in progress)

The generated campaign-layout audit found no offenders in L4, L5, L8, or L9. L7 has one remaining substantial placement: the Northgate `int.metro-exit`. It is a solid interactive building with a swinging gate used by the night-exit handover. L6 now has side-wall collision; the L7 static placement collider is absent. Treating the whole footprint as solid would close the authored route when the gate opens, so the remaining fix needs a shell collider that keeps the gate passage usable and a route regression check.

## Generated campaign layout counts

| Level | District | Placements | Eligible | Before | After |
| --- | --- | ---: | ---: | ---: | ---: |
| L4 | D-FAIR | 835 | 779 | 0 | 0 |
| L5 | D-FAIR | 889 | 757 | 0 | 0 |
| L6 | D-SUBWAY | 91 | 61 | 1 | 0 |
| L7 | D-FAIR | 937 | 783 | 1 | 1 |
| L8 | D-ZOO | 2,349 | 1,901 | 0 | 0 |
| L9 | D-CROSSING | 3,385 | 3,097 | 0 | 0 |

The audit uses the s211c threshold (footprint ≥ 0.4 m² and height ≥ 0.5 m) and requires a non-physics-only collider at every active tier (0–6). It measures collider coverage, not visual hull fidelity or physical movement contacts. Machine-readable counts are in [audit.json](audit.json).

## Verification

- Generated-layout audit: L4/L5/L8/L9 zero; L6 zero after the change; L7 one (Northgate exit).
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused collision/world systems tests — 9 passed.
- `npm test` — 27 files, 106 passed, 112.3 s / 240 s budget.
- Two-shard full threat audit ran locally after the remote runners were unavailable. With the attempted Northgate side-wall collision, all skilled routes completed but the merge reported `L7/step/departure:SLOW_FOLLOWER:107`. The attempted change was reverted under the zero-flag rule. Receipt: `test-results/s218-threat/audit.json`. A subsequent full two-shard local audit with the L6-only walls passed with zero flags and all skilled routes complete: `test-results/s218-l6-threat/audit.json`.

This report records the baseline and open work; it does not claim the L4–L9 objective is complete. The side-wall attempt was committed as `af9bbae4` and reverted as `8c3857c7` after the threat flag. L6-only walls were retained in `ea0dcd0f`; L7 remains open.
