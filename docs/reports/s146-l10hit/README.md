# s146-l10hit · L10 farm melee

## Result

Fixed a product presentation cause of misleading melee arcs: the attack runner commits aim and combo reach when a swing starts, but the yellow cone previously followed the live cursor and base weapon definition. Turning the cursor during windup could draw the arc over an infected outside the actual committed strike. `ActionView` now uses the running swing's aim, arc and range. Idle preview still follows the selected weapon.

Also proved a driver false-positive mechanism: its unchanged-HP timer accumulates observation time without checking resolved attacks, arc, range or cover. Executing the exact source block with a target at 4 m for 8.5 seconds, then 1.1 m at nine seconds, satisfies its warning threshold with zero attack events. The owning driver lane should count only resolved attacks that qualify the named target and record attack IDs, query results and damage before issuing a product warning. No `tools/playtest` source was edited.

These findings do not identify which mechanism produced historical target #134's warning. Its original input/attack diagnostic log and live save were not found. The reviewed B113 still establishes visual overlap only. No universal guarantee is inferred from these bounded checks; original historical attribution remains open.

## Reproduction and evidence

- [evidence.json](evidence.json), below 200 KB, contains the native eight-second per-attack traces, weapon/facing, query selections, active-frame positions/heights, hit IDs, damage events, campaign scan, detector reproduction and both browser receipts.
- [b113-l10-capture.jpg](b113-l10-capture.jpg) is the reviewed archived frame showing the close target, melee cone and farm roof edge. It cannot expose the strike's committed aim or preceding eight seconds.
- [s146-l10-farm-melee-contact.json.gz](../../../tests/fixtures/saves/qa/s146-l10-farm-melee-contact.json.gz) is a constructed native farm contact at tick 13892, courier x=1168.9/z=-26 and real runner x=1170/z=-26, initially 60 HP. This is not the recovered B113 #134 save. It uses `campaign-save` and `campaign.cureResume`; generic L10 `opts.resume` is deliberately ignored by `Game.loadLevel`.

The native held axe probe logs 16 swings over eight seconds. The runner is selected at the first active frame and takes a 60-point courier melee hit. Later swings do not hit because it is dead. Controlled native probes apply a nine-second zero-damage stun after fixture capture to retain contact through windup; browser checks apply no stun, respawn or health modification. No infected stats or corpse lifecycle changed.

The native L5/L6/L8 controlled contact probes also register courier melee hits. At L7's start, soldiers kill the runner at tick 2 for 25+25+10 damage before the courier active tick 7; that is an intercepted probe, not courier damage. L9 starts in its APC.

A separate seed-1 `complete` campaign scan covers bounded 120-second windows in L5–L10. Living targets accepted by the running melee query within 1.5 m qualify; continuity resets on HP change or loss of qualification. L6 has 12 qualifying target-ticks (maximum unchanged span 6), L7 301 (maximum 17), and L10 10 (maximum 6). No >2-second flags occur. L5/L8/L9 have no qualifying melee contact in these windows. These are not full-route scans.

## Verification

- Existing combat battery: seven tests passed after adding the cursor-reversal regression. The regression starts eastward, reverses live input west during windup, verifies committed aim stays east, and requires damage only to the eastward target. No new test case was added to the inventory.
- Typecheck and lint passed after the render correction; the final small combat assertion extension passed the full combat file.
- Headless WebGL2, lock/pool, ports 5029/5030, HIGH then LOW: corrected fixture restores the original runner; axe hit at tick 67 deals 60 damage, 60→0 HP, zero page errors.
- Fresh HIGH then LOW moving-cursor browser assertions on the corrected renderer: committed aim east, live aim west, actual cone geometry remains east (relative X bounds about -0.027 to +2.135 m including line thickness). The east runner takes the committed hit in both tiers. Receipts are in `movingCursorBrowserRegression`. Earlier fixture failure was fixed by using the supported `campaign.cureResume` path.
- Full local suite before the render correction passed: 27 files, 106 tests, 139 seconds, inventory 150/150. This is not a post-render full-suite claim.
- Prescribed remote suite ran twice unchanged on 94.130.181.173 before the render correction. Both passed combat and failed the existing L4 contact test at its 150-second timeout: 104 passed, one skipped, one failed; total 207.8 and 216.6 seconds. Tests were not trimmed and timeouts were not increased. These remain failed full-suite gates.

## Open requirements

Historical #134 attribution remains unproven; product cone correction and driver detector defect are independently established. The complete post-change remote gate passed on the final code; earlier L4 timeouts are retained above as historical failures. A persistent render regression within the existing hit/render test infrastructure would strengthen the temporary browser assertions. No deployment, push or main movement occurred.

## Final remote gate

The prescribed unchanged full remote command passed on final source `3a7995aa` using runner 46.225.66.90: 27 files, 105 passed and one existing skip, 150-case inventory, 176.1 seconds within 240 seconds. L4 contact passed in 131.062 seconds without timeout or test changes. The prior two worker timeouts did not reproduce on this worker. No checks remain running.
