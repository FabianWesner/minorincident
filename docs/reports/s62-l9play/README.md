# S62 L9 rail stall, hatch and bus counterplay

## Design

- Rail stall: 20 seconds / 1,200 ticks on every route. HUD names the stalled engine, counts down `0:SS`, draws a ten-cell bar, explains shooting/closing the hatch and the restriction on leaving the APC. Sam announces the hold and restart. On restart: `Engine restarted — drive! (W)`.
- Hatch: opens on the rail transition; courier raised to show her arms and weapon, aim follows the mouse; F/E toggles the hatch while holding. Passengers remain inside. Removed the APC's side-projected blood overlay, which stretched into a red roof band; dents, cracked glazing and smoke show damage.
- Bus: locks a lane for a 1.5-second HUD/red-road warning and horn. Steering 4.5 m out of the lane avoids the ram. A miss sends it toward the opposite verge, stuns it for three seconds and costs it 600 health. Two misses wreck it. Successful rams cost 40 APC armour, capped at three hits. A destroyed bus stops pursuit, explodes after its existing delay, and remains as a wreck.
- No infected stats or corpse removal changed.

## Evidence

| Requirement | Result |
| --- | --- |
| Rail recovery on road, countryside, dry shortcut | Isolated native recovery matrix (bus/waves suppressed): each restarted at +1,200 ticks, then drove 13.83 m in 120 ticks. |
| Countdown, hatch and restart story | `node --import tsx/esm tools/qa/l9-story-proof.ts`: passed through phase `done`, including ten-cell bar assertion. |
| Skilled bus driver <=1 hit | `node --import tsx/esm tools/qa/l9-bus-driver-proof.ts`: real simulation throttle/steering, 2 misses / 1 hit, APC armour 925, bus health 0, stopped pursuit; delayed explosion completed and wreck entity retained. No attack deadlines or player poses assigned after encounter setup. |
| Passive driver survives to bay | `r42/l9-bay-probe.ts --route road --mode w --max 151`: bay at tick 9009, durability 535 at tick 9060, zero courier deaths. The later unattended evacuation hold can still consume armour; arrival survival is verified. |
| L9 threat flags | Latest `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled/passive complete, **0 L9 passive flags**. Exit 1 is solely `PARTIAL_LEVEL_SELECTION`, the tool's selected-level diagnostic status. |
| Checkpoint/bay safety | `tools/qa/l9-checkpoint-proof.ts`: passed, preserving original checkpoint resume/retry and bay assertions. |
| Leaper/thrower scene | `tools/qa/l9-setpieces-proof.ts`: passed, preserving original assertions. |
| Existing boss roster/cues | `tools/qa/l8-boss-proof.ts`: passed, preserving original assertions. |
| Typecheck/lint | Passed on current implementation. |
| Final local verifier | `npm run verify -- E31`: passed typecheck, lint, 27 files / 107 tests; test phase 93.0 s. |
| Final exact remote npm test | `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 27 files, 106 passed / 1 skipped, 187.7 s against unchanged 240 s budget; 150 configured cases. |

## Opened headless captures

All runs used `tools/e2e-lock.sh`, one headless browser, ports 4967/4968, Space handbrake, god off. Servers were stopped afterward. Capture root: `test-results/s62-l9play/`.

- `roof-fix/s006-t1514.jpg`: countdown 0:17, bar, Sam's line, arms/weapon visible above hatch; no red roof band.
- `captures/s012-t2547.jpg`: APC beyond the crossing, Sam's restart line; log also records the `Drive! (W)` objective.
- `bus-lane-fix/s009-t667.jpg`: red lane and dodge HUD, APC steering out with W/D input. Fixed a renderer defect found here: infected-only telegraph cleanup immediately deleted vehicle warnings; bus warnings now follow the active ram countdown.
- `bus-camera/s025-t982.jpg`: bus front visibly crumpled against a roadside obstacle; runtime records stopped pursuit. Presentation-only camera targeting kept the bus in view. Encounter setup establishes the initial car/bus poses, then all driving is keyboard input.
- A separate `bus-wide` real-input run records bus HP 0 and `damage: exploded` at ticks 876 and 1066; native proof independently verifies wreck persistence.

## Scope and test workload

Gameplay changes: `LevelNineDriving.ts`, Sam dialogue, and a narrow eastbound-heading guard in `LevelNineCrash.ts` exposed by the story checkpoint proof. Render changes: APC blood-overlay removal in `VehicleView.ts`, vehicle telegraph lifetime in VFX. These are the small overlaps with neighboring gameplay/render lanes.

The per-change vehicle test had accumulated level-specific story checks, contrary to `docs/qa/test-strategy.md`. Moved those checks to the standalone QA proofs above, preserving their assertions and running them successfully. Fixed four shadowed duplicate world loads that leaked the worlds actually exercised by the boss helpers. Reduced Vitest workers from four to two to avoid concurrent large-world heap pressure on shared runners/the busy Mac. No assertions or test-budget limits were raised; configured count remains at most 150.

Earlier remote runs timed out at 240 seconds and exposed a navigation test with too much world-loading work. Its L7 check now runs in the existing chaser test, preserving assertions and the 30-second limits. Final results above supersede the earlier failed runs.

## Repository handling

Initial restricted-sandbox setup/staging/browser attempts failed. After full access was supplied, slim-worktree setup succeeded, captures ran and commits were created. No protected reference directories or specs were edited. No push, deployment, merge or main-branch changes.
