# s246 · L8 opening

## Intended timeline

| Event | Target timing / destination | Current evidence |
| --- | --- | --- |
| Arrival | Player and convoy group unload at D-ZOO arrival (layout anchor, z≈70); no Nadia tour | Verified from loaded L8 world. Opening mission text is `Clear the zoo`, marker is the zoo entrance. |
| Breach | 20 s after mission start | `arrivalCalmTicks = 20 * 60`; story helper asserts the breach tick. |
| First attack | ≤35 s after arrival; attacks on group and courier ≥6/min during hold | Passive courier at arrival, seed 1: first attack at 28 s on HIGH and LOW. HIGH 69 attacks (11 on group), LOW 47 (10 on group) during the 30 s hold, or 138 and 94/min combined. Counts use the threat audit's attack-start observer. |
| Protect end | Fixed 30 s after breach, at the arrival gate | Tick 3000, 50 s after arrival; the hold deadline does not extend when the courier leaves. |
| First arena | Flamingo arena after the opening hold and the group reaches/seals at the plaza; marker leads into flamingo gate | Seed 1 skilled simulation: plaza seals at tick 4437 (73.95 s), flamingo encounter starts at tick 4687 (78.12 s). The route test asserts the next marker after each clear. |

## Marker order

After the plaza seal, `L8BossArenas` order is flamingo → lion → monkey → zebra → gorilla → elephant. The objective marker is computed from the first uncleared arena and its entry nodes. The route fixture asserts each next-arena marker after the preceding clear.

## QA status

- Starter tour-skip diff applied and reviewed.
- `npm run typecheck`: passed after the latest runner reporting and test changes.
- `node --import tsx/esm tools/qa/diag/l8-protect-arrival.ts`: north gate spawn at z=89 was rejected after the camera settled. Moving it to z=108 admits six infected. Using navigation around the obstruction at z=106 brings four within 15 m at breach +6 s and three within 2.6 m at +12 s.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L8`: skilled completes with 28 survivors saved from a roster of 29. Staging Hale and Reyes with the arrival group eliminated the follower waiting flag. A longer L8 corgi follow prediction removed the final pace flag: the corgi median is 4.80 m/s versus the group median 5.03 m/s. One L8 flag remains, sustained unreachable share. Partial level selection is informational.
- Nightly mission interactions: passed (41.59 s), including the pond keeper story, first attack within 35 s, at least three attack starts during the 30 s hold, the fixed hold deadline, and the marker assertion after each arena clear. The south gate cohort now uses navigation around the same kind of obstruction as the north gate.
- After correcting the two soldiers' calm patrol waypoint to stay near arrival, nightly mission interactions passed in 44.15 s. A post-commit threat audit of `ee0b2989` again completed skilled with 28/29 saved and one L8 flag: 8/49 infected reachable at the worst sample, with a 108 s blocked interval. The partial-level-selection flag is informational.
- The previous passive unreachable evidence occurred while the courier was held inside the closed flamingo arena: 0/40 outside infected could reach the courier for 106 s. The closed arena and remaining follower behavior need a game-side resolution.
- Tried directing followers to the close catch-up target at 6 m rather than 10 m. The L8 audit worsened from three to fifteen flags despite skilled completion; the change was reverted.
- The previous flagged follower was a resident who joined 7.6 m from the courier. Increasing the speed cap for separated followers from 1.12 to 1.2 times courier speed reduced the audit from three flags to two; the identity of the remaining slow follower changed to 354.
- Follower 354 is the corgi, not a civilian. In the skilled breached phase its median was 4.50 m/s against a 4.84 m/s group median; in the passive phase it was 4.50 against 4.57. Its separate companion navigation and arena-wait paths need investigation rather than further tuning the civilian formation.
- Tried reopening the flamingo entry after 15 s of combat while keeping the group waiting outside. The audit still reported 0/40 reachable for 108 s and the same three L8 flags; the change was reverted. The passive courier was against the pen rim at (12.75, -29.40), so gate state alone did not explain the path result.
- Corrected the passive policy to follow the same next-arena approach as the normal bot after its opening hold. Skilled still completes; the audit still reports three L8 flags. Its worst passive sample now places the courier at (0.91, -18.17), with 8/49 infected reachable over a 108 s blocked interval. The new evidence points to the entry approach as well as closed-gate isolation.
- Retested the 15 s entry-release variant with the corrected passive approach: the result stayed at one L8 reachability flag, 8/49 reachable and 108 s; reverted. An independent tick-7200 probe shows the flamingo encounter in phase 1 with `armed: false`, player (0.91, -18.17), and the plaza sealed. Thus its entry gate had not armed at that point; the remaining disconnection needs path/grid investigation rather than an entry-gate timeout.
- Tried reopening the plaza once the flamingo fight starts. The worst sample improved from 8/49 to 12/50 reachable but still had a 108 s blocked interval and the same reachability flag; skilled completion saved 28. Reverted because it did not satisfy the gate and changed the plaza's established barrier behavior.
- Focused stationary protect measurement (seed 1, passive courier, god mode): HIGH first attack tick 1680, 69 total starts, 11 on followers; LOW first attack tick 1680, 47 total starts, 10 on followers. Breach tick 1200, hold ends tick 3000. This measures attack starts, including interrupted windups, as in the audit.
- `npm run lint`: passed after removing an unused local in the arrival diagnostic.
- `npm run verify -- E30`: passed the shared per-change gate after the checkpoint fix: typecheck, lint and 107 tests across 27 files; unit time 135.1 s / 240 s. The separate remote-unit requirement remains open.
- Remote isolated unit run: initially failed at 245.8 s against the 240 s limit (exit 124); an L8 vehicle fixture also expected the removed tour. The fixture now checks the 20 s breach and arrival marker, and exposed a stale checkpoint-restore tour marker which was corrected. A remote rerun passed the vehicle file but again timed out at 245.6 s (exit 124), so the complete remote unit gate remains unmet. The local E30 gate completed within budget.
- HIGH then LOW captures at 35 s, WebGL2 Metal, one pooled headless browser, passive god-mode courier at the normal follow camera: [protect sheet](protect-sheet.jpg). In HIGH, several infected surround the courier within a red attack ring and soldiers fire beside the group; in LOW, two infected stand at the courier in striking range while a soldier fires. The foreground building obscures part of the group, and the still LOW frame does not independently prove an attack animation; the attack-start measurement above supplies timing evidence. No browser errors were recorded.
- The zero-flag threat audit and remote unit timing remain open; E30 verification passed before the latest runner reporting and test changes.
