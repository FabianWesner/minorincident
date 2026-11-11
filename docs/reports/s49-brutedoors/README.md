# s49-brutedoors — wide-body path audit

## Result

Added `tools/qa/wide-body-audit.ts`, a native campaign audit for wide infected bodies. It runs L1–L10 at high simulation quality, records authored/runtime wide spawns and their encounter source, samples player positions, and checks routes with the sim's navigation grid at the body's radius plus a 0.1 m margin. L4 uses its wide-body grid; L9 builds a full authored-world navigation grid so streamed districts are checked against the whole road extent. It also reports narrow ground-level openings on checked paths.

The final run recorded **175 wide-body spawns**, **0 unreachable paths**, and **0 narrow openings**:

| Level | Wide spawns | Unreachable | Narrow openings | Runner outcome |
| --- | ---: | ---: | ---: | --- |
| L1 | 0 | 0 | 0 | complete |
| L2 | 0 | 0 | 0 | complete |
| L3 | 1 | 0 | 0 | complete |
| L4 | 39 | 0 | 0 | complete |
| L5 | 3 | 0 | 0 | complete |
| L6 | 4 | 0 | 0 | complete |
| L7 | 5 | 0 | 0 | complete |
| L8 | 4 | 0 | 0 | tick budget |
| L9 | 107 | 0 | 0 | complete |
| L10 | 12 | 0 | 0 | complete |

L8's normal bot reached its tick budget without finishing the mission. The audit separately exercised its four authored wide outlet roles after the mission's gates opened; all four had a path. The east outlet is intentionally sealed behind the zebra gate before that arena clears, so injecting it at the opening would test a closed gate state that the runtime does not use to admit its wave.

No level-layout change was indicated by the path/opening audit. No stat, scale, or corpse-removal changes were made.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: local passed, 107 tests across 27 files. Required remote retry passed with 106 passed and 1 skipped across 27 files; test budget reported 150/150 cases.
- `node --import tsx/esm tools/qa/threat-audit.ts`: completed with the known counts L1=0, L2=1, L3=2, L4=4, L5=3, L6=4, L7=6, L8=0, L9=0, L10=0. L3/L5 retain the queued regression values; this lane made no encounter/threat changes.
- The remote nightly retry completed after a runner became available: five tests passed and the high-tier L2 market-ambush failed (24 admitted, 23 reached); both war-wave tests passed. Earlier remote attempts had no healthy runner. Local nightly fallback (`npx vitest run --project nightly tests/qa/invariants/waves.test.ts tests/qa/invariants/war-waves.test.ts --maxWorkers=4`) completed with five passing tests and one existing L2 market-ambush census failure (24 admitted, 23 reached). The war-wave tests passed.
- The requested slim-worktree command was attempted first, but its Git config write was blocked by the sandbox (`.git/worktrees/s49-brutedoors/config.worktree: Operation not permitted`). After filesystem restrictions were lifted, the required slim-worktree command succeeded. `node_modules` was already present. `docs/process/lessons-learned.md` was read.

## Browser QA needed

No fixed spots remain from this audit. A visual pass is still useful to confirm wide bodies do not clip while moving through these authored spaces:

- L4 tent aisles and their camp approaches, especially the Alpha cohort routes.
- L8 zoo tunnel mouths and the east outlet near world position (99, 32), with the zebra exit gate open.
- L9 roadside encounter approaches along the streamed APC route, where the audit checked 107 wide spawns against full-world navigation.

No browser session was used for this lane.

## Remaining qualification

The audit now returns a failing exit code when it reports an unreachable body or narrow opening. Its census is runtime coverage, not a proof that every authored branch was exercised; L8 explicitly needs the outlet fixture because the campaign bot exhausted its budget. Exhaustive authored encounter coverage remains unproven.

The L2 nightly diagnostic identifies missing entity 216 with no final entity transform. This indicates a lifecycle loss rather than a demonstrated wide-body opening jam. This lane has no source or test changes relative to its base, and L2's audited census contains no wide bodies. The required nightly gate remains red.
