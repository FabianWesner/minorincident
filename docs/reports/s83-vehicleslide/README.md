# S83: APC infected foot-slide

## Status at the requested stop

Stopped at the PO's ~5-hour time box. **Covered numeric states pass; overall acceptance remains open. Browser QA needed.** All sixteen attributed HIGH/LOW rows and all eight native campaign windows pass. Largest measured maximum: **13.9 cm**; highest per-track p95: **2.8 cm**. This does not certify every grab/vehicle situation listed below.

The last running native matrix finished exit 0. The queued twenty-row control rerun was cancelled before admission at the user's instruction. No further experiments were started. No check from this work remains running. No push, deployment or main movement.

## Retained root fixes

- AgentMotion reports resolved velocity/distance for APC-attached infected instead of suppressing their movement. CrowdView passes resolved travel direction to footwork.
- Contact inheritance starts at the inherited plant rather than jumping into mid-swing. Losing the detailed footwork budget transfers standing contacts to the cheap solver.
- Both shared foot solvers respect loaded leg lengths and inner/outer reach bounds. Cheap recovery releases an exhausted stance and lifts an overextended target instead of dragging a grounded shoe through an IK clamp.
- L9 registers existing dog/zebra rigs before late spawns, avoiding a human fallback. Zebra contact cadence follows distance using the shared paw solver.

These are shared presentation/motion changes. Infected stats and AI balance are unchanged; corpses persist. No specs, threat tools, protected assets or reference repositories were edited.

## Attributed contact gate

All rows pass. Values are highest per-actor **p95 / max, centimetres**, not pooled percentiles. Evidence: [final-contact.json](final-contact.json).

| State | HIGH | LOW |
| --- | --- | --- |
| surrounded | 2.0 / 13.9 | 1.1 / 3.9 |
| push | 1.8 / 3.2 | 1.4 / 3.1 |
| reach-recovery | 1.6 / 2.3 | 1.6 / 4.5 |
| ram | 0.3 / 0.8 | 1.7 / 2.0 |
| ram-survivor | 0.4 / 0.6 | 0.4 / 0.6 |
| prop-push | 0.5 / 0.6 | 0.2 / 0.5 |
| prop-momentum | 0.2 / 0.4 | 0.2 / 0.2 |
| clinging | airborne + boarding proof | airborne + boarding proof |

Fixtures prove real hull attacks, resolved .12 vehicle shoves, prop impulses/momentum and six living reverse-ram survivors per tier. Reach-recovery exhausts only the presentation budget and witnesses all six bodies in the cheap solver for >=120 frames. No HP/speed overrides. Clinging requires attachment events, vehicle travel, all 300 boarding-frame foot samples and complete airborne travel/clearance proof over frames 181–300. Airborne p95 remains undefined rather than a zero-slide substitute.

## Native campaign windows

Final headless WebGL2 matrix: **8/8 pass**, identical stable runtime hash across tiers. Evidence: [final-native.json](final-native.json). Full sole tracks remain locally under `test-results/s83-vehicleslide/campaign/`.

| Native window | HIGH p95 / max cm | LOW p95 / max cm |
| --- | --- | --- |
| L9 | 2.8 / 3.3 | 1.3 / 5.1 |
| l7-bus | 0.4 / 0.5 | 0.3 / 0.5 |
| l4-parked | 0.9 / 1.7 | 1.6 / 2.1 |
| l4-tank | 1.8 / 2.6 | 2.0 / 6.4 |

L9 uses the full native level and ordinary complete bot on the road detour for 9000 ticks. L7 observes the parked evacuation bus; L4 observes the parked convoy and tank hold for 1200 ticks after production-controller preparation. These are not proof of L7 departure or moving L4 contacts. At the native LOW cap, QA relocates living actors without healing, raising caps or deleting entities.

| L9 context | HIGH | LOW |
| --- | --- | --- |
| driving | 2.8 / 3.3 (1287 contacts) | 1.3 / 5.1 (1716 contacts) |
| detour | 2.8 / 3.3 (1287 contacts) | 1.3 / 5.1 (1716 contacts) |
| rail-stall | 2.8 / 2.8 (5 contacts) | 0.2 / 0.2 (11 contacts) |
| hatch | 2.8 / 2.8 (5 contacts) | 0.2 / 0.2 (11 contacts) |

The observer includes registered/static hulls, drawn rig soles and actual support floor. It measures crowd separation and solid-hull correction windows, including half a second either side to capture the recovery landing. Limits remain p95 <=5 cm / max <=15 cm. Missing/incorrect feet, unverified airborne walking, stale reactions and planted special-move slide fail. Short running flight requires advancing phase/root motion, changing foot height and near-floor clearance. Reactions must match active simulation state.

Every visible track is checked. Prepared scenes require two sustained moving witnesses (>=60 observed frames, >=20 cm travel); a whole-window root audit independently proves stationary bodies. All staged entities must persist. Receipts retain individual coverage. The complete unfiltered/unsharded scene gate invokes both vehicle suites and propagates failures; negative integration controls verify this.

## Opened captures

Opened the PO screenshot: red-eyed infected and smaller orange-haired body beside the APC grille in smoke.

Opened [apc-consecutive.jpg](apc-consecutive.jpg): HIGH zoom 1.5, consecutive frames 140–145, whole APC, infected by the front wheel and left rear, advancing attack arc. No gross foot snap is visible. Native-resolution crops preserve the game camera; sole tracks provide centimetre measurements.

Opened [cheap-recovery-consecutive.jpg](cheap-recovery-consecutive.jpg): HIGH zoom 1.5, frames 146–151, reversing APC. Attackers are mostly occluded by the grille, so this sheet cannot independently certify feet. It is the retained sheet for the combined cheap-solver fix.

Also opened the final native HIGH L9 strip, frames 8885–8890: APC beside the rail, infected/zebras clustered along its hull, smoke covering feet. Dense overlap/climbing readability needs browser QA. This local strip is not an extra committed sheet.

## Validation

- Complete attributed vehicle gate: exit 0, sixteen rows.
- Complete native vehicle matrix: exit 0, eight windows; sequential, one browser, one ten-minute reservation.
- Full remote `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 106 passed / 1 skipped, 200.2/240 seconds. No trimming; this checkout collects 107 tests.
- Remote `npm run verify -- E09`: exit 0, complete suite 106 passed / 1 skipped, 201.5/240 seconds, plus typecheck/lint. Retained runtime is unchanged since verification.
- Local typecheck/lint passed before the last observer-only bookkeeping edits; final repeats remain open.
- `sh tools/qa/l9-progress-regression.sh`: exit 0, all eighteen cases.
- L9 threat: zero skilled/passive level flags. Aggregate diagnostic exit 1 solely `PARTIAL_LEVEL_SELECTION`; not a full-campaign pass.

Transcripts under `/private/tmp/`: `s83-final-contact.log`, `s83-final-campaign.log`, `s83-final-unit.log`, `s83-final-verify.log`, `s83-final-route.log`, `s83-final-threat.log`.

## Browser QA needed / remaining work

- Dedicated ordinary courier-grab and Alpha grab beside a vehicle are not independently attributed. Hatch, hull attacks and vehicle-grabbed/boarding evidence do not prove every humanoid grab special.
- Browser review of native L9 driving, rail stall, hatch and detour against the PO complaint; boarder slot overlap and climb transitions. Earlier coincident attachment slots were observed and not changed by this foot-contact work.
- L7 bus departure and moving L4 convoy/tank contact windows; current evidence is parked/hold observations.
- Twenty existing motion-control rows after the latest cheap-solver change. Earlier pass predates it; final rerun was cancelled while queued at the requested stop.
- Final typecheck/lint after observer bookkeeping; manual WebGPU review remains unperformed.

Implementation commits include `10ce2b95` (cheap reach recovery) and `4b51bdd6` (persistent gates). Historical JSON/sheets remain available; this README and `final-*.json` supersede their earlier acceptance status. No further experiments after the stop request.
