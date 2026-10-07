# Campaign foundation — wave 0

2026-10-07, lane `campaign-foundation`. Main was already an ancestor at the start; no merge was needed. No spec, manifest, dependency, or protected reference changes.

## Changes

- `b5846710` — real mission actor spawning through E09 vehicles, E11 devices/destructibles/pickups and E08 escorts; device progress and damage interruption; actual driver/arrival/exit conditions; continuous zone holds; inventory checkpoint rollback; global L3 deadline and retry grace; countdown in the tracker. Dead drivers eject through the existing exit/roof fallback so cleanup can respawn them.
- `015a3484` — `--level`, `--policy`, `--seeds` and JSON reports; completion/newbie policies reuse the L1 Walker and issue ordinary movement, attack, interaction, throttle and steering inputs. `test:levels` runs three seeds per level and fails when any run does not complete. Smoke Vitest is capped at two workers.
- `071f83d0` — fix the existing bicycle saddle alignment unit failure, restore the parked kickstand, and keep the cargo parcel aligned with the shifted model. The existing mouse smoke arrival target now uses the open sidewalk away from the bicycle's safe parking spot; its distance threshold is unchanged.

- `8e2d9bd1` — preserve the existing touch interaction prompts for story-driven objectives such as L1 handover; native device prompts continue through the existing interactable HUD.

## Real-input completion results

`npm run test:levels`, seeds 1–3, policy `complete`, default 1,200-second budget per run. No god mode, teleports, injected loadouts, or objective cheats. Begin/Retry/Skip use the ordinary mission menu actions. Times below are simulation seconds, excluding the final cinematic.

| Level | Completed | Furthest objective through real play | Time | Content/system still missing |
| --- | --- | --- | --- | --- |
| L1 | 3/3 | `firestation`, completed | 114.02–116.45 | Existing L1 policy reused; full E19 balance/visual closure remains with its lane. |
| L2 | 3/3 | `board`, completed after both living followers arrive | 102.52–102.67 | Gym rescue encounters, pistol/Molotov grants/tutorial, barricades, boarding protection and bus departure. Current graph has no authored infected encounter. |
| L3 | 0/3 | `market-route`, active; `car` completed and sedan entered/driven | 59.43 | Sedan stalls at the supermarket approach. Needs a vehicle-safe approach/parking point and improved routing/recovery for the long chassis; a pedestrian grid does not account for its turn radius. The alternate park route is not proven by this policy. Riot/checkpoint barrier and collapse content remain. |
| L4 | 3/3 | `bridge`, completed after breakers, fuse, crossing and destruction | 73.33 | Zoo shed and encounters, physical wreck push/blast alternatives, Butcher and power cascade. Fuse is still at the existing zoo entrance anchor; blockade is an E11 barricade proxy. |
| L5 | 3/3 | `hold-4`, completed after all four continuous holds | 559.70 | Authored waves, shared convoy HP/blockage rules, barricade slots, generator pressure, mega hazard and bridge twist. Timer/occupancy completion alone is not a defense acceptance result. |
| L6 | 0/3 | `drive`, active; school, mall and engine completed | 157.07 | Engine stalls near the Civic station; needs safe vehicle placement and an authored driving corridor/handling route. Each run dies once to decay fire and successfully retries. D-GROVE start/connectivity, protected driving, collapse, helicopter boarding/dawn/credits remain absent. |

L3 seed 1 stops at `(35.695, 37.738)`, 11.20 m from the market anchor, with the actual driver attached and the sedan at 300 HP. L6 seed 1 stops at `(13.243, 105.246)`, 96.72 m from the edge anchor, with the actual driver attached and the engine at 1,600 HP. These are observations of the current policy and collision state, not proof that a human cannot negotiate the route.

Aggregate: **12 completed / 18 runs**, **6 stalled**, **3 player deaths**. JSON: `test-results/sim/all-complete.json`. The command correctly returns exit 1 for the six incomplete runs.

`npm run sim -- --level L2 --policy newbie --seeds 20`: **20/20 completed**, zero deaths/failures, median 103.10 s. JSON: `test-results/sim/L2-newbie.json`. This proves the new entry point/policy; it does not calibrate the future populated level.

## Validation

All heavyweight commands use `tools/sim-lock.sh`; browsers use the repository's `tools/e2e-lock.sh`, headless, at most two workers, Metal on this Mac, preview port 3323.

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `sh tools/sim-lock.sh sh -c 'npm run test:unit -- --maxWorkers=2 2>&1'` | PASS: 237 tests, 75 files |
| `sh tools/sim-lock.sh sh -c 'npx vitest run tests/sim/missions tests/sim/interact tests/sim/vehicles --maxWorkers=2 2>&1'` | PASS: 107 tests, 13 files, before adding driver-death regression; that added regression passes in E12 verification. Redundant final repeat canceled while still queued after over 30 minutes waiting for the shared sim lock. |
| `E2E_PORT=3323 sh tools/sim-lock.sh sh -c 'npm run verify -- E12 2>&1'` | PASS: typecheck/lint/build; 70 Vitest tests; 27 browser tests |
| `E2E_PORT=3323 sh tools/sim-lock.sh sh -c 'npm run test:smoke 2>&1'` | PASS: 5 Vitest tests; 22 browser tests |
| `npm run test:levels` | FAIL as expected for current content/policy: 12/18 completed, 6 stalled |
| `sh tools/sim-lock.sh npm run sim -- --level L2 --policy newbie --seeds 20` | PASS: 20/20 completed |
| `sh tools/sim-lock.sh npm run sim -- --level L3 --policy complete --seeds 2 --ticks 600 --out test-results/sim/campaign-tick-budget.json` | PASS: both runs stop at exactly 600 ticks / 10.00 s and report `tick-budget`. |

All 12 adapter tests passed across the focused run and E12 verification: the focused run covered the first 11 (including both L3 timer tests), and E12 verification covered 10 adapter tests including the added driver-death regression. The adapter suite covers the three device kinds, standing/range interruption, native vehicle arrival/exit, escort arrival, nested zone holds/target destruction, combat destruction, pickup/checkpoint rollback, two L3 deadline/retry tests, and driver-death respawn. All six existing L4 structural task orders remain covered.

## Scope and deviations

Current E12 validation JSON/screenshots are preserved under `test-results/epics/E12/campaign-foundation/`; existing tracked evidence files are restored to avoid unrelated artifact churn.

No acceptance criteria were weakened and no specs were edited. This delivers wave 0 integration, not completed E20–E24 epics. Missing content is exposed by the runner, including real driving failures, instead of bypassed. L4's entrance fuse and destructible barricade are temporary uses of existing anchors/systems; the maintenance shed and the two specified wreck solutions still need their content lanes.

L6 still uses D-RES despite the approved D-GROVE staging decision. Grove's 170×110 m boundary does not share the existing 56×56 m district slab edges; blindly appending it would overlap the town or leave the current full-edge perimeter blocking traversal. A deliberate layout/connectivity handoff is required before switching the entry anchor/composition.

Policies take the first active branch/task. Vehicle navigation reuses the existing grid, with steering lookahead/reverse recovery; it needs vehicle-specific route tuning at the two observed stalls. L4 task-order randomization, continuous campaign progression carryover, barricade building and calibrated newbie time bands belong to the following waves. No idle delays were added to meet a time band. No merge, push or deployment was performed.
