# sweep-g — closeout

**NO-GO. Stopped at the orchestrator’s explicit closeout instruction on 2026-11-06.** All work is committed locally; nothing pushed or deployed. No background sweep or preview server remains running.

## Numbers

Of **21 assigned rows (G-06–G-26)**:

- **5 retained qualified PASS:** G-10, G-11, G-12, G-16, G-24.
- **9 measured FAIL:** G-09, G-13, G-14, G-15, G-17, G-18, G-20, G-22, G-26.
- **7 open / qualification incomplete:** G-06, G-07, G-08, G-19, G-21, G-23, G-25.
- **3 game defects fixed across 2 rows:** two G-08 guidance defects and G-25 large-save quota failure. These fixes do not close their whole rows.

The retained passes are prior qualifications, not a claim that the final-source global matrix completed. The canonical [acceptance tracker](../../qa/acceptance-status.md) and [global report](../fix51-verify/global.json) retain the last complete historical matrix (`9ac18b3e…`), including the historical G-25 failure. Final partial native evidence was archived before restoring those generated files. This README and the row evidence below describe the subsequent work; do not combine their source identities into a fresh whole-group PASS.

## Fixes

| Row | Commit | Change and proof |
|---|---|---|
| G-08 | `ff10a70` | L4 cellar HUD uses the actual destination, 79 m rather than the next-turn route distance of 315–318 m. Both qualities physically exercised; [diagnosis](G-08-diagnosis.json). |
| G-25 | `7bd7cdf` | Lossless gzip encoding for large saves, legacy plain JSON compatible. Original failing 6,152,854-byte save becomes 1,577,123 storage code units, preserving both snapshots and every entity/seam. [Codec proof](G-25-save-codec-proof.json); native browser quota, Settings save and reload proof committed `ec78438`, with 1,141 current and 1,134 checkpoint IDs preserved and zero errors. |
| G-08 | `89ef6f9` | Removed the player-following nav-steering cone; kept authored destination ring/arrow. Physical movement moves the hero 2.666 m low / 2.579 m high while the destination stays fixed; two marker children remain. Before/after evidence committed `290b751`. |

The separate L10 driver correction (`16ba576`) uses ranged combat, moving cover and recovery from no movement; no mission/objective writes or lowered criteria. Final L10 low/high both reach credits through three production-save/resume batches each, zero page/console errors and no objective skips. Survival protection (`immortal:true`) is explicit. Four complete L10 routes passed across the save-fix source and final source. **Final-source global browser coverage is only 2/20 complete cells, plus one interrupted L1 low run.** G-25 remains open. The originally suspected L4 shadow crash was not reproduced; no shadow fix is claimed.

## Rows and remaining work

| Row | Result | Finding / next work |
|---|---|---|
| G-06 | Open | All saved route frames inspected; [rocket/corgi original review](G-06-final-rocket-corgi.json). No established mesh collision from the suspect firing-effect view. Full vehicle/occluder pose coverage remains incomplete. |
| G-07 | Open | Prior 12 critical fixtures pass. [Final scoped observations](G-07-final-closeout.json): 36 valid fence/pile frames, heroine visible. Two L7 horde setup rejections retained; full horde/critical-route coverage missing. |
| G-08 | Open, 2 fixes | Remaining L6 gate/platform handoffs, Mega action points and L7 departure markers need authored-state and same-frame reconciliation. |
| G-09 | FAIL | [Fresh review](G-09-final-closeout.json): L4 hold explicitly suppresses the objective ring beyond 180 ticks, both qualities and zooms 1/1.5. Reconcile authored suppression with the every-step visibility criterion. |
| G-10 | PASS retained | Prior native refresh: 22 checks in 20 level/quality fixture receipts. |
| G-11 | PASS retained | Final both-quality pickup fixtures reviewed (`8023bad`): courier-only ring, one collection, 5.796 m leave/revisit, no respawn. |
| G-12 | PASS retained | Final 70 group samples, 9 frames including negative control (`e7fe7ff`): compact pips at 35/6, full bars at 5/1. |
| G-13 | FAIL | High Dale search pace 93.59%, Metro 94.58%; intentional waiting low 0.748%, high 0%. Rejected pace-floor trial reverted. Final full native refresh interrupted. |
| G-14 | FAIL | Floating, pointed/folded corpses persist, including final L10 both qualities (`d6945be`). Permanent-ID lifetime evidence retained; interval counts are not unique-body totals. |
| G-15 | FAIL | [Final controls](G-15-final-closeout.json): facing 71.1° off walk at 0.767 s after release, beyond 0.45 s grace. Thirty frames reviewed. |
| G-16 | PASS retained | Prior all-20 start-loadout qualification; L10 axe only. |
| G-17 | FAIL | [Final animation refresh](G-17-final-closeout.json): womanB wander retains nearly horizontal knee splay. Eight strips/64 crop frames supplement prior full identity inventory. |
| G-18 | FAIL | Final 300 cells (`d1705e7`): eight paired L3/L4/L6/L8 cases ignore nearby escort in finite courier-focus mode, walking 7.5–10 m toward a courier 30 m away. Ordinary rush control attacks escort within 120 ticks. |
| G-19 | Open | [Final 56 frames](G-19-final-closeout.json): Metro shelter and convoy sampled. L6 upright/open gate frames do not establish a successful closed-gate handoff. Both L7 departure setups rejected; cinematic zoom overrides retained. |
| G-20 | FAIL | Final 18 valid cells (`376ec0e`): L7/L9 immediate zero runout both qualities; 14 others protected for 300 ticks. Two L5 cap/setup rejections preserved. |
| G-21 | Open / contract conflict | Four direct respawn cases (`08bc061`) restore checkpoint position exactly but retain live gate/pickup changes. Literal global snapshot differs from authored E19 PO live-world contract and E22 L4 exception. [Summary](G-21-literal-snapshot-summary.json). No criterion weakened. |
| G-22 | FAIL | L3 station 0 starts 24.983 s, station 2 never; high stationary 30.983 s. All 92 bounded paths meet ≤2.5× direct distance. |
| G-23 | Open | Both-quality perimeter refresh: 423 runs, 1,269 walk approaches and 990 clear vehicle approaches each, zero failures. Physical wrong-way route-clarity coverage missing. |
| G-24 | PASS retained | Final five bar states × both qualities, 10 originals reviewed (`987fead`). |
| G-25 | Open, save defect fixed | Both final L10 cells pass; 18 remaining final-source cells unqualified. Interrupted L1 evidence is explicitly incomplete. |
| G-26 | FAIL | [Final 28 frames](G-26-final-closeout.json): floating coffee cap, zoo bag-holder and phone-arm stretching persist; 141 LOD height rows match hero height 1.454 m. |

PO handoffs also include L6 foreground outline appearance, APC door-panel appearance, blank purple L7 perimeter/sparse L10 roads, and the crawler 42° exemption. No speculative asset, AI or physics changes were made to erase measured failures.

## Validation and provenance

Final game source hash: `f7c6992a57ac3d3bcf07ec6da0e20466a1cc28eb2b2fc3f4db4585b6660ed657`.
Observer hash: `9179102da8341b22bf530fc4cde87f8c517c555317a30b5fad472579256f99cb`.
Final browser hash: `a35dfd0fdce06b38750f10aaabd68e4860e041d66ca4dbdad9e83b6878c9da2a`.
See [build receipt](build-final-cue.json).

- **Requested final `npm run qa:threat`: PASS**, once, sequential, after own browser/native jobs stopped and one-minute load reached **5.88**. All 10 levels, **0 failure flags**, 342.2 s audit / **344.4 s total**, budget 600 s. [Receipt and hashed archive](threat-closeout/receipt.json), including raw audit, per-level JSON, Markdown and console log. This low-population threat audit does not replace the global browser/quality matrix.
- Save fix: both TypeScript projects, lint and existing six save tests passed, including large Unicode/NUL, corrupt gzip and small legacy identity coverage.
- Final marker fix: typecheck, lint and QA build passed. Earlier complete unit/gate archive (`f2c3675`, 107 tests and threat 355.8 s) belongs to the prior source. No final full unit or epic verification rerun is claimed.
- [Final native partial inventory](final-native-partial/README.json): **50 completed receipts** — 14 complete policies, 13 stationary policies, 12 fixtures and 11 checkpoint controls. Interrupted on explicit closeout; this is not the required full 40-policy/20-fixture/20-checkpoint refresh. Historical complete evidence remains immutable.
- [Interrupted L1 log](G-25-final-cue-L1-low-webgl2-interrupted.jsonl.gz) and [five reviewed captures](G-25-final-cue-L1-low-webgl2-captures.json) preserve progress without fabricating a completion receipt.
- **2,638 raw captures** hashed, viewed, observations recorded and deleted: [cleanup ledger](capture-cleanup.json). Derived review sheets remain only under ignored `test-results/`; no screenshots committed.

To resume, complete the final-source browser/native/fixture/checkpoint matrices, address the measured failures, then deliberately consolidate acceptance reports. Current evidence does not authorize a global GO.
