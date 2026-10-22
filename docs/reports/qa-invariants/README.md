# QA invariant sweep evidence

Status: implementation in progress. The required `lane/batch13i` baseline has not yet been checked out. This worktree currently points to `0a548ca87` (`lane/qa-invariants`, regression-gate docs commit), so results below are diagnostic observations on that tree and must not be reported as batch13i or 13g evidence.

## First diagnostic sweep

Command: `npx vitest run tests/qa/invariants/contract.test.ts --maxWorkers=1 --configLoader runner` (7 checks, seed 1). Elapsed: 31 seconds in the first run; 46 seconds in the subsequent full sim run.

| Check | Evidence from current tree | PO mapping / disposition |
|---|---|---|
| Accessories | Passed asset manifest head attachment and per-rig fit bounds. | P1-108/P1-115; broken metadata assertion exists, deliberate red execution still to be recorded. |
| Seated NPCs | Failed for L2 active sitters 127–130: a bench was found, but the oracle initially compared each sitter to the bench center. The authored seats spread along the bench; the oracle was changed to check the support footprint and authored height. | P1-112; corrected oracle needs rerun before interpreting this as a game bug. |
| Scripted actors | Passed depot clerk existence for the entire pickup beat in the current tree. | P1-109; deliberate missing-actor fixture still to be recorded. |
| Vehicles vs solids | Failed at `tank-route-2-0.00` against a registered solid; perimeter wall solids have now been added to the swept route check. | P1-116; exact overlap and rerun evidence pending. |
| Waves | Initial check found no wave because it started at the convoy phase. It now enters the authored L4 alarm beat directly; that run produced >1 live infected reaching the hold area. A precise alarm count assertion has been added. | P1-118/P1-119; exact authored-count rerun pending. |
| Objective visibility | All mission-step anchors resolved across L1–L10. | P1-114; this state-level anchor check is not yet proof of 2-second marker visibility or camera/story-shot visibility. |
| Ground | Found three >20 cm center-height mismatches: D-CIVIC fire station (`0.53` vs `0.30`), D-GROVE fire station (`0.53` vs `0.30`), and D-SUBWAY `l6-0/fixed-33` (`0.55` vs `0.18`). | P1-113/113b class; route-specific L3 ramp evidence and false-positive review pending. |
| Load time | Headless Playwright spec did not reach Playwright. `tools/perf/quiet-run.sh` remained in its Mac GPU guard; its `ps`/`pgrep` process sampling is denied by this sandbox (`Operation not permitted`). Ctrl-C cleanup hit the same denial while enumerating child processes. | P1-107; Mac/WebGPU low + PROD baseline receipt pending. |

## Baseline receipts

| Baseline | Result |
|---|---|
| batch13i (`ba436b90a`) | Not run. A checkout attempt failed because the shared git worktree metadata is outside this workspace's writable roots (`.git/worktrees/qa-invariants/index.lock`: `Operation not permitted`). |
| 13g | Not run. |

The remote receipt is also pending: `npm run qa:invariants:sim:remote` reached `tools/remote/pool.py`, but DNS/network resolution failed (`nodename nor servname provided`), so the runner selector returned `no runner available` before syncing or starting a remote job.

## Latest sim evidence

Command: `npm run qa:invariants:sim` (two Vitest files). Latest duration: 60.7 seconds. Thirteen tests passed and two checks were red. Seat poses were sampled every sim second across L1–L10 (seed 1, campaign-ready state). `npm run typecheck` passed after the final sim edits.

- **P1-116 vehicle red:** OBB sweep identifies the tank route intersecting `prop.privacy-fence:44`, `prop.privacy-fence:45`, and `l4-perimeter-1`; this matches the PO's tank-through-barrier route. Horizontal and vertical extents are tested. Parked-vehicle poses use authored physics boxes and omit their own collider.
- **Ground red:** raised walkable support mismatches: D-CIVIC fire station (`0.53` vs `0.30`), D-GROVE fire station (`0.53` vs `0.30`), and D-SUBWAY `l6-0/fixed-33` (`0.55` vs `0.18`). The L3 raised-road gap itself still needs a route-sample receipt.
- **Green:** accessory metadata; active sit poses across all ten levels; L1 clerk persistence until the return-to-door exit; L4 alarm count matches the authored 18 high-tier arrivals, each emitted L4 wave count matches authored scaling, and infected reach the hold area; each mission step's marker activation resolves in its start tick across L1–L10; and all eight deliberately broken fixtures are caught.

The sim contract checks run well under the 15-minute ceiling locally, but the required remote run failed before dispatch because DNS could not resolve the runner service. The rendering check is blocked before browser launch by sandbox-denied process enumeration inside `quiet-run.sh`. L3 route-specific ground evidence, batch13i/13g receipts, bus/APC and dismount vehicle routes, and commits remain pending. Git writes are blocked because `.git/worktrees/qa-invariants` is outside the writable roots; no commit was made.
