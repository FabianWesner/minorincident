# fix71-b — remaining L4/L6 acceptance fixes

Work in progress. No deployment or push.

| Row | Current evidence | Remaining |
| --- | --- | --- |
| L6-06 | Six authored side entries now admit two each, both native tiers. Commit `fe30ed0`. | Final-source track trajectories and physical capture review; group acceptance rerun. |
| L6-11 | Both mortal native tiers save **26/29 = 89.66%** with complete; evade-only saves **1/29 = 3.45%**. Complete has zero deaths; evade-only has nine ordinary deaths and completes. [Receipt](L6-11-native.json), [full compressed trace](L6-11-native.json.gz). | Physical route/capture review is running; final group gates remain. |
| L4-13 | Not yet changed. | Actual collapse admissions at every edge. |
| L4-12 | Not yet changed. | Nearest-20 infected look distribution. |
| L4-16 | Not yet changed. | Decoded filtered battle audio spans at least six seconds in all four cells. |
| L4-17 | Not yet remeasured. | Current corpse layout and rendered poses after spreading changes. |

## L6 covering repair

MG projectile births used absolute height 0.7m and later cover queries discarded projectile Y. Raised subway floors therefore made rifle-clear shots collide with low cover. Projectiles now originate at the same rifle height as hitscan guns and keep their height during every cover query. The existing combat suite includes a raised-floor MG regression: low cover clears; full cover still blocks. The focused suite passes all seven cases.

The completion controller also used walking LOS for gun targets and enabled immediate group-bite priority only for its newbie profile. Current bite receipts showed walking-blocked but rifle-clear targets; the controller now uses the production rifle sight query and applies the existing bite priority to its complete policy too. Ordinary weapon stats, enemy counts, damage, attack clocks and population caps are unchanged.

Unarmed L6 followers keep the authored 2.2m/s formation instead of being diverted into faster general panic flight. When infected threaten the column, its head waits for rear covering fire throughout the route, using the existing 12m covering distance. Earlier trials with a tighter wait and shelter-wide gathering caused extra losses and were rejected.

## Validation status

Before the L6 covering repair, full L4 acceptance completed its native stages and failed at the browser bind with `listen EPERM` under the earlier sandbox. The environment now permits browser work. Full `qa:threat` hit its 600s budget during L5; its earlier L1–L4 stages reported zero passive flags. A targeted L6 diagnostic measured 100% retreat reachability; its two flags explicitly denote partial selection and unverified main-source provenance, so this is not a zero-flag whole-game sign-off.

Final `tsc`, lint, unit suite, L4–L6 acceptance and the isolated whole-game threat gate remain pending.
