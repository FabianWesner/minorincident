# s113-l4tank — L4 LOW tank contact regression

## Status

Implementation and simulation audit are in place. The requested vehicle-campaign gate and remote unit suite are **not verified** in this managed shell, so this report does not claim the objective is complete.

## Root cause and change

The native LOW tank fixture reported actor 163 with `separationM` movement and lifted/sliding contact against the tank. The crowded-body cleanup applied its spacing nudge through `NavGrid.move`, which checks baked navigation solids. The tank is a live hull with exact OBB geometry in `SolidRegistry`; final solid commit performs that check after spacing. Crowd pressure could therefore propose motion into a hull before the final collision repair.

L4 crowd-separation proposals now validate against the exact solid registry. If the full nudge meets a hull, the resolver retains a clear axis slide along its face where possible. The change is limited to L4. No gate threshold/classification, actor inclusion, zombie or weapon stats, alarm cohort, corpse handling, or HIGH caps changed. LOW caps are restored to 80 infected / 120 living characters; HIGH remains 160 / 230 and the alarm cohort remains 36.

This mechanism matches the gate's `separationM` evidence and the source write order. The post-fix visual/motion confirmation for actor 163 remains open because the locked browser gate could not launch here.

## Vehicle-campaign gate

Before, as supplied in the task: `l4-tank`, LOW failed `L4/hull-ground/163 grounded` with `slideMaxCm 17.1`, `slideP95Cm 1.9`, `yawDriftMaxDeg 21.5`, `liftMaxCm 17.9`, `worstSlideFrame 313`; correction failure `separationM/163`.

After: **no gate output**. `VEHICLE_CAMPAIGN_CASE=l4-tank E2E_PORT=4931 SCENE_PORT=4932 npm run qa:vehicle-campaign-motion` was attempted through `tools/e2e-lock.sh`. The browser-pool wrapper failed to start its localhost listener (`EPERM`, port 4329). The legacy lock path also failed because `tools/mac-gpu-guard.py` requires `ps`, which this shell denies (`PermissionError: Operation not permitted`). No second browser or dev server was started. The gate must be rerun in an environment where the approved lock and host guard can run.

## L4-06 census

The full threat audit's HIGH hold census passes both L4-06 clauses:

| Tier / census | First breach, level clock | Alive at breach | Minimum plaza alive after +45 s | Peak living |
|---|---:|---:|---:|---:|
| HIGH hold | 50.08 s | 77 | 42 | 91 |
| LOW hold (informational) | 50.08 s | 46 | 13 | 61 |
| LOW stationary (informational) | 50.08 s | 46 | 13 | 61 |

The criterion now explicitly gates on HIGH and prints LOW census details as information. LOW's `alarmCursorAtEnd` was 36, and no L4 breach cohort flag was raised. Peak living in the LOW stationary census was **61**.

## Full threat audit

Command: `npm run qa:threat` — completed in 293.7 s. It reported exactly one fail flag:

- `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`

The L4 north breach cohort flag remains absent. Full generated receipt: `test-results/qa-threat/audit.json`; rendered output: `test-results/qa-threat/README.md`. The LOW census and criterion detail are present in the current audit receipt.

## Validation and remaining work

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run qa:threat -- --proof` — passed, including the proof that poor LOW values are informational and cannot fail L4-06 when HIGH passes.
- `sh tools/remote/run.sh "$PWD" -- npm test` — could not start: no healthy/provisioned Hetzner runner, and this command is ineligible for local fallback. Runner tooling documentation identifies provisioning as an explicit orchestrator operation; none was initiated.
- Required: rerun `npm run qa:vehicle-campaign-motion` through the e2e lock in an environment with browser-pool/host-guard access; verify L4-06 HIGH and LOW census after the cap change; run the remote unit suite once a healthy runner is available; update this report with the after-gate receipt; commit the completed lane.

No push, deployment, or main movement was performed.

## Full-access continuation evidence

The full vehicle campaign gate ran to completion on ports 4931/4932. L9, L7 bus, L4 parked, and L4 tank HIGH passed. L4 tank LOW failed: actor 251 slideMax 37.5 cm / p95 6.3 cm / liftMax 34.8 cm at frame 1160; actor 220 slideMax 7.1 cm / p95 5.8 cm / liftMax 6.2 cm at frame 1002. Actor 163 no longer fails. The proposed separation guard is insufficient; further contact tracing is required. Current receipts are under `test-results/s83-vehicleslide/campaign/` with source hash `6542048c075517a71f757aa2c165677f9c71136e5668803ea577199824d816ec`.

The required unchanged remote unit suite subsequently passed: 27 files, 106 tests passed / 1 skipped, manifest 150/150, 216.6 s against 240 s. Runner job `/srv/mi/jobs/s113-l4tank-40c15d-25066-1794673092`, exit 0. The earlier runner and browser access blockers are resolved. The vehicle motion defect remains open; no commit yet.

## Current focused fix

The shared separation budget is now applied only within 0.5 m of solid geometry. It permits up to 6 cm of total crowd correction per tick there, preventing accumulated neighbor pushes from producing a large cleanup shove; ordinary separation away from obstacles is retained. Both HIGH and LOW tank fixtures pass in the latest locked run (exit 0). Full batch, final audit and source checks must be refreshed for this version. Earlier receipts above describe superseded variants. The remote suite passed before this final contact-budget refinement.
