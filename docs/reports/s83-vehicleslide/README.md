# S83: APC infected foot-slide

## Status

**In progress.** The L9 attached-infected animation speed defect is fixed and focused checks pass. The requested all-state HIGH/LOW contact motion gate and visual capture review are not yet complete, so the acceptance objective is not met.

## Finding and change

The L9 attached-infected path repositions boarders with the APC every tick. The shared resolved-motion pass in `AgentMotion` then explicitly set their render velocity and speed to zero and did not advance gait distance. `CrowdView` uses those values to select locomotion clips and stride phase, so carried roots moved while their pose remained stationary. The pass now reports the resolved displacement for attached infected just like other actors.

The PO screenshot at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/reports/po-slide-apc.png` was opened. It shows an infected upright beside the APC's front/side hull, with another smaller infected partly visible at the rail. The still does not identify the exact contact state or prove its root-motion history.

## Verification so far

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `sh tools/qa/l9-progress-regression.sh` — passed for all 18 path/route/seed cases.

## Remaining acceptance work

- Extend the persistent Scene Lab motion gate to directly create and measure vehicle push, hull separation, clinging/boarding, and ram knockback states. Include grab/hatch attackers, prop pushes, and crowd overlap near vehicles where those paths can move infected roots.
- Run each contact state in L9 driving, stalled-at-rail, hatch-fight, and detour contexts, plus the relevant L7/L4 vehicle scenes, at HIGH and LOW. Prove per-state p95 <= 5 cm and max <= 15 cm with sufficient foot-contact samples.
- Open and describe a consecutive-frame APC capture strip at HIGH zoom 1.5.
- Run the L9 threat audit and confirm zero flags.
- Run the complete requested validation set, including the remote unit suite, and commit the remaining gate/capture work when focused checks pass.
