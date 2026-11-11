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

## Authored L10 coverage extension

The audit now additionally enumerates all wide slots from `cureEncounters` and `curePaceEncounters` in both tiers, using the production slot and spot helpers against full-world collision. The isolated run completed with 79 records (12 runtime plus 67 authored checks) and two candidate failures: `farm-road-pair-4` armored at (1400.79, 91.03), once per tier, cannot reach its station (1400, 100) with the clearance margin. This supersedes the earlier zero-failure runtime result for L10. Production admission eligibility/lane adjustments still need qualification before classifying or fixing this candidate. Typecheck and tool lint passed.

## L10 warehouse approach fix

Full-world collision diagnosis places the failed armored slot inside warehouse `bld.cure-warehouse:92/geometry-0` (warehouse extends to z=94). Its clearance-grid start cell is invalid; nearby road cells at z=100 connect normally. Moved `farm-road-pair-4` from (1400, 100) to (1400, 106), preserving its ID and roster. The armored slot now clears the warehouse's south face. The isolated L10 audit rerun completed with 79 records, zero unreachable paths and zero narrow openings. The earlier no-layout-change statement is superseded by this fix. Full regression gates still need rerunning after this layout adjustment.

Browser QA needed for this fixed spot: at the industrial warehouse near x=1400, follow the three-member `farm-road-pair-4` approach along the south frontage; verify the armored body emerges outside the warehouse, reaches the road without clipping, and remains clear of the street lamp/container stack.

## Post-fix regression gates

After `b73f7976`, typecheck and lint passed. The exact remote `npm test` command passed (27 files, 106 passed/1 skipped; 150/150 case budget; 205 s). The exact remote nightly command completed with five passing tests and the same single high-tier L2 market-ambush failure (24 admitted, 23 reached); both war-wave tests passed. The threat audit completed with unchanged per-level counts 0,1,2,4,3,4,6,0,0,0 (L3/L5 are the explicitly queued regressions). No check was left running.

## Spawn-origin qualification

Corrected runtime route retries to retain each record's original spawn coordinates rather than accepting a route from its later position. The complete L1–L10 rerun exited zero with 242 records, zero unreachable paths and zero narrow openings: level counts 0,0,1,39,3,4,5,4,107,79. L8 retained its tick-budget outcome and four explicit outlet checks. L10 includes its 67 authored tier checks. Tool lint passed. This closes a false-pass risk from scripted movement or AI relocation; authored branch coverage outside L10 remains to be completed.

## L9 fixed-group coverage receipt

The audit now compares the production L9 admission ledger against every fixed group that authors the requested wide roles (road formations cycle brute/armored; shortcut formations explicitly author Alphas). All four expected groups were fully admitted: `road-1`, `road-2`, `dry-shortcut-3`, `dry-shortcut-6`. No expected group was missing in the isolated L9 rerun, which exited zero with 107 wide spawn records and no unreachable paths/openings. A missing group now fails the audit instead of silently passing a partial route census. Typecheck and tool lint passed. This qualifies fixed groups across alternate routes; L9 set-piece branch coverage remains separate work.

## L9 set-piece coverage receipt

Native set-piece spawn instrumentation now records each actor's authored set-piece ID and requires the full wide-role quota: two each for `leapers-1`, `leapers-2`, `stall-ambush`, `stall-rush`, and one each for `thrower-1`/`thrower-2`. The isolated run recorded these exact quotas and all four fixed groups, with no missing sources and 107 pathable wide records. Set pieces with only dogs, ordinary runners or obstacles are excluded from this wide-role quota. Typecheck and tool lint passed before adding the quota comparison; the recorded counts satisfy that comparison. Route-dependent set-piece placements on unplayed alternate lanes remain a coverage limitation.

## L9 six-lane audit

Added optional L9 route/detour observation hooks to the shared runner, preserving its existing default road detour. The audit now drives all three authored routes and both main/detour traces. All six completed, recording 434 wide spawns total (road 136/107, countryside 57/45, shortcut 43/46), with zero unreachable paths and zero narrow openings among admitted bodies. The coverage gate correctly fails: `thrower-2` was not admitted on either countryside trace. Other expected fixed-group and set-piece quotas were met. This is a new admission-coverage finding requiring diagnosis, not a passing exhaustive result. Typecheck and lint passed; no check remains running.

## Countryside thrower admission fix

The native `thrower-2` diagnostic showed a clear/resident/director-safe post with available capacity, but only 96.81 m Euclidean separation from the APC. The lane bends within the nominal 112 m lookahead; even the spawner's 4 m search cannot meet its binding 105 m minimum. Added a countryside-only trigger at x=180 (default remains x=200). The resulting native post is 112.75 m away and admits successfully; the diagnostic drive completes. IDs, body sizes, counts and the admission minimum are retained. Typecheck and changed-file lint pass.

A preliminary global trigger move was rejected: although road and countryside audit scenarios completed, the shortcut run took substantially longer and was explicitly interrupted before producing a result. The committed route-specific authoring preserves other routes' trigger positions. The complete six-lane audit and regression gates must be rerun for the committed fix.

Browser QA needed: on both countryside traces, verify the second thrower is already present outside the driving frame before the bend near x=200, then throws from the verge without clipping the APC lane or appearing onscreen at admission.

## Countryside-only fix validation

The complete six-lane L9 audit now exits zero: 442 wide records, zero unreachable paths/openings, and no missing fixed-group or set-piece quotas. Counts are road main/detour 136/107, countryside 61/49, shortcut 43/46. Road and shortcut counts match their pre-fix runs; both countryside traces now admit the missing second thrower.

Required regression commands completed after the fix. Remote `npm test` passed (106 passed/1 skipped; 150/150 case budget; 209.3 s). Remote nightly remained five passed/one failed, solely L2 market-ambush 24 admitted/23 reached; war-waves passed. Threat counts stayed 0,1,2,4,3,4,6,0,0,0, including the queued L3/L5 regressions. The threat run took 1025.6 s under shared Mac load but completed. No check remains running. The red L2 nightly gate and exhaustive source coverage for other levels remain outstanding.

## L3 street-branch qualification

L3 now runs each explicit native street policy (Boulevard, Commerce, Oak) and requires its authored route-Alpha admission ledger. All three runs completed and passed the quota/path/opening checks: 1, 3, 3 wide records respectively, including repeated runtime admissions. Every recorded spawn origin has a checked path. Typecheck and tool lint passed. These are the three authored street branches of `l3.density.alphas`; the audit no longer relies on an auto-selected street for L3.

## L6 hatch source census

Added a coverage gate requiring a recorded wide actor matched by ID and spawn tick to each authored wave-4 hatch ledger entry. The native run completes with four pathable wide records, but covers only hatch 3. Hatches 2, 5, 6, 4 and 7 are missing from the wide census; the audit now exits failure rather than implying exhaustive coverage from that bot route. Closed/omitted hatch cohorts need an explicit open-hatch fixture before this level is fully qualified. This finding is a coverage gap, not a demonstrated collision blocker. Typecheck and tool lint passed.
