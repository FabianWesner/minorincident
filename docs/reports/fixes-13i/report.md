# Fixes 13i — #101, #102, #104

## Implementation

- #101: charging and killing the Mega Alpha are separate objective steps. The existing boss stages 24 m from the console when the charge finishes if it is distant, retaining its health and combat settings. The boss objective follows its position through the existing arrow, ring and minimap pin. Old saves with the combined objective migrate to the new steps.
- #102: the exit-platform snapshot waits for all living survivors to cross the checkpoint boundary. Following guards keep one normal formation movement intent while defending the retreat, without stale backsteps or a return to their former stationary post.
- #104: browser observations read the console E prompt from the rendered mission tracker and remain self-contained under Playwright serialization. Console E takes priority over nearby combat. The L7 driver regroups around living, drawn survivors. No-skip runs disable navigation and objective completion assists.
- Regressions were exercised red before their fixes: distant boss arrival/marker, the exit guard plus 15 death/restores, guard retreat under fire, console observation, browser serialization and visible escort following.

## Validation in progress

- Typecheck and lint pass on `b779aff6e`.
- Headless smoke: **31/31 passed**, one worker, ports 4111/4112, browser admission lock. [Log](evidence/smoke.log.gz).
- Focused L6 guard and ally defence regressions: 32 passed. Finale, save migration and playtest observation regressions: 24 passed.
- Remote unit/level suite and real-input L10 run are active. These gates are not yet certified.
- L6 male seeded fists remains unverified: v5 reached exit-platform but stalled on the raised stairs; v6 aborted at retreat with `No visible progress for 30.0 s; stopping without advancing the objective`. Its log shows a fast death/respawn retained an old movement reference, then falsely timed out while courier and marker advanced. No objectives were skipped.
- The orchestrator granted 30 additional minutes, restricted to the raised exit stairs.

## Raised exit investigation

- The exit is reachable and readable: the captured view shows the stair runs, exit arrow and minimap pin. The physical movement probe crosses both runs at z=15 and z=17.3, reaching x284 at street height y4.62. Walking between the stairs at z=16.195 instead reproduces the exact failed position x255.045, y0.71. [Probe](evidence/exit-reachability.log.gz), [failed approach](evidence/exit-stairs-failed.jpg).
- Driver cause: clipped ground clicks drifted into the gap, while rounded keyboard steering discarded the small lateral correction toward the marker. L6 exit steering now retains that correction using short physical key pulses toward the visible marker. No game geometry, navigation or marker was changed. [Red](evidence/stair-steering-red.log.gz), [green](evidence/stair-steering-green.log.gz). A fresh full male fists run is active.
- L10 real input reached the charge console after every preceding objective, then failed with `No visible progress for 30.0 s; stopping without advancing the objective`. The visible E text is in HUD `objective-text`, while the attempted observation fix reads the separate `mission-tracker`. Permission to correct this within the restricted extension is pending.
- Remote exposed a simulation-bot compatibility regression after the new `mega` objective: the existing console-centred fight/dodge policy still matched only `hold`. The same policy now covers both steps; assertions are unchanged. Verification is active.
