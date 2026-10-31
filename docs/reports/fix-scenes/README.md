# Scene fixes — Q-262–267 and Q-269 HP bars

PO 10-30 (verbatim): "I hopefully don't find any obvious glitches anymore (like clipping (tanks over walls), ugly figures, z-index issues, massive load times...)".
[Final visual review on main](../final-visual/README.md): "It reads as one dark lump, not a squad."; "It looks like debug UI." Reviewed its captures 01–20, especially 01–06 and 20.
Fixed vehicle corpse placement, checkpoint formation, feathered shelter reveal/rim, Metro objective occlusion, APC queue/live count, cone-prone hat fit, and the nearest-five L10 enemy HP bars.
[Viewed comparisons and receipts](evidence/index.html): low/high × zoom 1/1.5, nine before/after sheets plus boarding HUD; zero late shader builds; 17/17 and 37/37 corpses retained; twelve officers/twelve destinations; 13/13 aboard; five HP bars. Probe endpoint occlusion is documented.
[Checks](checks.json): npm test 110/110; smoke 6 QA + 1 public; scene:gate 48/48 (zero known/skipped); named isolated scenes 46/46; typecheck/lint pass. Gameplay runtime f3b6cac63; existing companion fixture sequencing repaired in bbb6208a7.
Committed per item on lane/fix-scenes; gameplay camera and L5 balance unchanged; corpses persist; no new test files. Task cache/QA preview removed, pooled contexts closed, no private browser profiles created; 16 GiB free.
