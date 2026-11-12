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

CrowdView now passes the simulation motion velocity into CourierGroundContacts, whose existing travel argument plans sideways/backward steps while keeping body facing. Previously only speed reached this solver. This applies to actors with resolved simulation motion; render-sampled fallback actors retain the existing path. Typecheck and targeted lint pass. The isolated HIGH/LOW contact diagnostic remains unchanged, including its transition failure. InfectedSystem installs AgentMotion in this fixture as well; the prior inference that resolved motion was absent was unproven and is withdrawn. Actual campaign and per-state motion evidence is still required.

## Executable contact checks

The diagnostic now exits nonzero unless each infected supplies at least five contacts, p95 <= 5 cm and maximum <= 15 cm; vehicle events must prove at least six ram combat hits or four hull windups plus a durability hit. HIGH/LOW rerun completed with exit 1, retaining the surrounded failure. Targeted ESLint passed. This remains partial coverage, without clinging/boarding or all campaign contexts.

## Remote unit suite

`sh tools/remote/run.sh "$PWD" -- npm test` completed exit 0 on 46.225.66.90: 27 files passed, 106 tests passed and 1 skipped (107 collected), test-budget 204.3 s / 240 s. The complete command was run without test selection or trimming; this checkout’s count differs from the older 150-case job description. Local transcript: `/private/tmp/s83-unit.log`.

## Contact inheritance fix

Temporary instrumentation confirmed the detailed foot solver hands contacts to the cheaper solver as movement starts. No invalid-pose fallback fired. The incoming phase could already be mid-swing, so the cheap solver moved the inherited foot toward a landing immediately. GroundContacts now starts that first swing at the inherited plant. The same diagnostic passes: HIGH ram p95/max 0.3/0.8 cm; HIGH surrounded 2.7/13.9 cm; LOW ram 0.3/0.6 cm; LOW surrounded 3.5/4.0 cm. Typecheck and targeted lint pass. See `contact-after-inheritance.json`.

Reopened the updated consecutive HIGH zoom-1.5 strip: APC stationary, infected by the front corner and rear side, attack arc beside the hull. Foot detail remains small; numeric contact traces provide the measurable proof for these two fixtures. Missing push/clinging and campaign contexts prevent completion.

## Clinging coverage

Added a floor-policy driven APC fixture with infected at the actual boarding boundary (2 m lateral), followed by throttle input. Both HIGH and LOW record four vehicle.grabbed events. All four actors have zero ground contacts, so p95 is null and the gate deliberately fails; this is not a 0 cm slide pass. Attachment-relative foot motion, actual APC travel, and clearance need explicit proof before this state can pass. See `clinging-baseline.json`. Targeted lint passes.

## Attachment movement audit

Per-tick hull-relative tracing shows the clinging fixture’s APC travels exactly 0 m on HIGH and LOW despite its throttle script. Moving-cling coverage is therefore absent; the diagnostic now separately requires >=2 m of vehicle travel. The trace also reveals coincident boarder pairs: IDs 4/5 share along -1.4225, side +1.595; IDs 6/7 share along -0.7725, side -1.595. Attachment clearance rises from 0.1 m to 0.8 m, while horizontal slots stay fixed. Both the ineffective drive fixture and duplicate-side slot assignment require follow-up.

## Moving clinging fixture corrected

The driven=true fixture installed an idle pilot that overwrote scripted drive input. Using ordinary courier interaction followed by the drive command now yields four attachments and 8.76148 m of APC travel on both HIGH and LOW. The moving-attachment evidence passes. Ground-contact assertions remain red (0–1 contacts per actor), requiring a separate explicit airborne/attachment-relative pose proof. See `moving-cling-baseline.json`.

## Explicit airborne clinging proof

The settled cling window (frames 181–300) now requires all two-foot heel/toe samples on every frame, minimum ground clearance >=1.2 cm, and >=2 m travel for every foot. Four actual attachment events and >=2 m vehicle travel remain mandatory. Both tiers pass this explicit airborne proof; ground p95 stays undefined and is not represented as zero. All six current fixture/tier rows pass. See `clinging-airborne.json`. Targeted lint passes. This does not yet validate climb-transition contacts, hull-relative pose quality, duplicate slots, push states, or campaign coverage.

## Hull shove attribution

A diagnostic wrapper records actual resolved displacement for the vehicle overlap resolver’s authored 0.12 m knockback calls. HIGH/LOW ram each execute seven nonblocked shoves (maximum 0.12 m); surrounded and clinging execute none. All six current rows still pass. Ram coverage now additionally requires a resolved shove, not just combat hits. Typecheck and targeted lint passed. See `shove-evidence.json`. Separate shove-only contact windows and prop-push/campaign contexts remain unverified.

## Per-shove windows and executable entry point

`npm run qa:vehicle-motion` runs the persistent contact diagnostic under the browser lock on a default unique 49xx port. HIGH/LOW six-row run completed exit 0. Per-shove windows now retain nine frames (tick-2 through tick+6) with clip labels and independently recomputed motion. All seven ram shove windows transition into knockdown/death and contain no planted contacts: they prove reaction coverage, not standing shove slide. Separate low-speed surviving push coverage is still needed. Typecheck and targeted lint pass. See `shove-windows.json`.

## Standing reverse-push fixture

A slow reverse drive exercises 493 unique resolved hull shoves per tier on ordinary infected without stat changes. All eight current fixture/tier rows pass: standing push worst p95/max HIGH 2.9/6.1 cm, LOW 2.3/5.5 cm. Typecheck and targeted lint pass. The diagnostic hook was found to wrap itself between scenes and duplicate records; the harness now retains the original knockback method. Reported shove counts are deduplicated by tick/entity from the captured run; a rerun after the hook fix remains due. See `standing-push.json`. Campaign contexts and prop pushing remain outstanding.
