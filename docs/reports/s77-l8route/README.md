# s77 L8 route confinement and fight duration

## Results

The native route probe `node --import tsx/esm tools/qa/l8-gate-shoves.ts` now combines the closed-gate shove matrix with authored-route traversal. It passes 432 gate shoves, walks all 16 route edges, shoves outward at 10 route corners, and tests both sides of the two yard gates plus the elephant boarding-side gate. **Escape count: 0.** Every sampled walk remained within the authored route envelope (8 m from its segment polyline); the player reached every edge endpoint. The probe uses controlled starts only to set up a case and does not teleport the player to repair movement.

The L8 route integration test checks entry and return barriers on the arming tick and the following native tick. The elephant yard has no regular `l8Route.entry` box, so the south yard gate now arms after the courier and party move inside the safe zone; its gate and both gorilla return doors close on the next tick.

The skilled native flamingo bot uses ordinary army-MG fire only, no god mode, and clears the initial flock plus all three scheduled reinforcement flights (26 birds total):

| Seed | Fight time | MG shots | MG hits | Cleared | Player HP |
|---:|---:|---:|---:|:---:|---:|
| 1808 | 31.33 s | 249 | 121 | yes | 97.27 |
| 1809 | 28.05 s | 243 | 134 | yes | 100 |
| 1810 | 29.75 s | 241 | 123 | yes | 100 |

## L8 threat audit

Command: `node --import tsx/esm tools/qa/threat-audit.ts --levels L8`

Exact output lines:

> `[qa:threat] L8: skilled complete, passive tick-budget, 0 passive flags (59.5s)`
>
> `[qa:threat] 60.0s; 1 fail flags; test-results/qa-threat/README.md`

The generated `audit.json` has `levels[0].flags: []`, `levels[0].passiveFlags: []`, and no flagged L8 observation phases. The sole top-level diagnostic marker is `PARTIAL_LEVEL_SELECTION: diagnostic run, not a complete gate`; there are **0 L8 flags**.

The final gate-state receipt has `elephant: phase 3, armed true` and all five paired route doors closed (`entry: true`, `exit: true`). A prior diagnostic sample showed the defect: elephant phase 2 with `armed: false` left the gorilla entry and exit open. The elephant yard's dedicated south gate now arms after the party enters, so both gorilla doors close one native tick later. The audit proof covers closed cells, open route cells, sealed plaza, off-route occupants, and the elephant approach before and after arming.

The command is a partial-level diagnostic and exits nonzero for `PARTIAL_LEVEL_SELECTION`; this is a global diagnostic marker, not an L8 acceptance flag.

## Validation

- `node --import tsx/esm tools/qa/threat-audit.ts --proof`: pass.
- `node --import tsx/esm tools/qa/l8-gate-shoves.ts`: pass, including the 16-edge route walk and 0-escape shove checks.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `git diff --check`: pass.
- `tests/engine/missions.test.ts`: pass, 6 tests; includes live next-tick gate closure assertions for every route stage and the elephant yard.
- `sh tools/remote/run.sh "$PWD" -- npm test`: pass on 46.225.66.90; 27 files, 106 passed and one skipped; 203.6 s against the 240 s budget. Collection guard: 150/150 cases. This supersedes the earlier unavailable-runner attempts.

## Commit

Implementation committed as `38ac7eec`. Git metadata permissions were restored, and the required unchanged remote suite passed. All checks are terminal.

## Browser QA needed

No browser was launched for this task, as requested. A later visual QA pass should inspect the new/closed fence joins and the boarding-side gate in the rendered scene, then review flamingo telegraph lanes and return/landing animation continuously. The native receipts establish simulation movement and timing, not rendered visibility or animation quality.
