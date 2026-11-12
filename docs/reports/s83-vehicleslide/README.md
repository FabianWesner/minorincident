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
- L9 threat audit completed: zero skilled and passive L9 flags. The overall diagnostic command exits 1 solely for `PARTIAL_LEVEL_SELECTION`; this is not a complete campaign gate. See `threat-summary.json`.
- Run the complete requested validation set, including the remote unit suite, and commit the remaining gate/capture work when focused checks pass.

## Vehicle-contact baseline

The ram and surrounded Scene Lab fixtures now assert 5 cm p95 and 15 cm maximum and retain actor traces. Both HIGH and LOW runs fail. The aggregate p95 10.8 cm / max 19.5 cm is the courier boarding transition; surrounded infected p95 values are 1–2.5 cm, with one infected maximum 16.9 cm at frame 38. See `contact-baseline.json`. These initial fixtures do not yet prove every requested contact state occurred.

Opened the HIGH surrounded sheet: a stationary APC with four infected moving away around its hull. The catalog sheet samples every 19 frames, so it does not satisfy the consecutive-frame capture requirement.

## Contact peak investigation

The surrounded infected-3 maximum contact begins at frame 38, while its root is still at [-1, -2.5] with reported speed zero. The same contact spans the idle-to-lurch transition and subsequent movement. This points to checking pose/foot-anchor continuity before attributing that full contact displacement to vehicle shove. The gate now reports each required actor’s maximum as well as p95, preserving the aggregate checks. Typecheck passes after that harness change.

## Production vehicle AI diagnostic

`tools/scenelab/vehicle-contact-motion.ts` removes Scene Lab’s L1 search controller, matching the existing L9 APC harness. The prior catalog baseline did not do this. Both tiers now record 14 windups and 12 hull hits in surrounded and six combat hits in ram. Ram contacts pass; surrounded maximum remains 34.5 cm HIGH / 34.6 cm LOW, with p95 below 5 cm. See `native-contact-summary.json`. State-specific clinging/push coverage remains outstanding.

Opened `apc-consecutive.jpg`: HIGH zoom 1.5, consecutive frames 140–145, stationary APC with infected at its front corner and rear side. The red attack arc advances beside the hull; feet are small at this framing, so this strip alone cannot certify planted-foot quality.

## Largest production contact discontinuity

The HIGH surrounded infected-3 left toe jumps from [-1.144, 0.002, -2.705] at frame 3 to [-0.816, 0.004, -2.621] at frame 4. The root advances only millimetres while the clip changes from infected-idle to infected-lurch. This is a pose transition discontinuity rather than a 34 cm vehicle root shove. See `transition-trace.json`; subsequent lurch stance positions remain nearly fixed. No acceptance claim is made from this diagnosis.

## Resolved travel direction

CrowdView now passes the simulation motion velocity into CourierGroundContacts, whose existing travel argument plans sideways/backward steps while keeping body facing. Previously only speed reached this solver. This applies to actors with resolved simulation motion; render-sampled fallback actors retain the existing path. Typecheck and targeted lint pass. The isolated HIGH/LOW contact diagnostic remains unchanged, including its transition failure, and does not prove this change improves campaign contact slide. Campaign motion evidence is still required.
