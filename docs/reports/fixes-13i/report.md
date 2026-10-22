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
- The original 60-minute driver budget is exhausted; an extension has been requested before further driver edits.
