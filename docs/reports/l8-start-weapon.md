# Q-198: L8 starting weapon

The L8 boundary preset racks the bat first on LEFT, followed by the axe. RIGHT
contains rockets, MG, shotgun and handgun. `setLoadout` selects LEFT index 0.
Previously, `applyCampaign` only restored selection when `selectedAction` existed;
`restoreSelectedAction` also returned immediately when it was absent. That made
the bat the starting weapon despite a usable MG in the same arsenal.

| Entry path | Before this fix | After this fix |
| --- | --- | --- |
| L7 → L8 | Completion records the actual held action; a carried bat stays selected. There is no unconditional bat reset here. | Preserve the carried action when racked and usable; otherwise select the best usable owned, racked weapon. |
| Continue into L8 | A recorded usable action survives. A pre-Q-158 save without selection keeps LEFT index 0 (bat). | Missing or unusable selection chooses the rocket launcher from the default L8 arsenal. |
| Level select L8 | The debug boundary fixture discards selection and leaves the bat selected. | Preserve the current selection when present in the boundary rack; otherwise use the same fallback as Continue. |

The screenshot alone cannot distinguish legacy Continue from level select: both
previously produced the same bat selection. A bat explicitly carried out of L7
remains intentional under the requested carried-weapon-first rule.

Fallback prefers usable guns in the existing number-key order, then axe and
bat. Empty magazines/charges are skipped; bottomless campaign guns are usable.
An innate fists selection absent from the destination racks also falls back.
Unarmed ranks below usable carried weapons, including older unkeyed melee weapons.
The L9 crash still strips the arsenal to the axe, and L10 displays: “The crash
took our weapons. The axe is all we have.”

Regression coverage includes every L1→L2 through L9→L10 handover, menu Continue
including saves with no selection at every level, L1–L10 level selection with a
progressed save, unavailable/empty weapons, gun→axe→bat fallback, and the L10
arsenal-loss HUD subtitle. Restoration changes indices without spending ammo
or starting a swap cooldown.

The full remote gate also exposed a stale selection in the L6 campaign runner:
its simplified completion path copied racks but never the action actually held.
It now records `heldAction` at completion, matching production handovers; the
existing complete/newbie timing and completion assertions remain unchanged.
The corrected newbie campaign takes 1318.57 simulation seconds, matching an
unchanged-main comparison; the stale-selection run took 1592.7 against 1590.

Validation: 68 focused tests, typecheck, lint, build and smoke (6 simulation,
35 headless browser checks) passed. Remote unit+levels passed 2789 tests with
that single L6 failure; after the runner correction, both L6 campaign policies
passed their unchanged assertions (2790 distinct passing tests, 9 skipped).
