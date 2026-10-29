# Full nightly matrix audit

Frozen main matrix: **2157/2190 pass; 33 fail; zero missing or abnormal children**.

Targeted corrections verify 23 originally failed rows. 10 rows remain filed: L5 contacts (#1/#2) and convoy lens-mask assertion (#4). Two additional closest-zoom bike assertions are filed after the instant-camera repair. Reconciled result: 2178 passing rows, 12 filed failures; this combines the baseline with the complete affected-consumer reruns.

| Scene | Failed baseline rows | Classification / action |
| --- | ---: | --- |
| alpha-hit-corpse-hoodie | 4 | measurement defect; fixed: coherent hue vector |
| collision-l5-metro-ingress | 6 | game visual defects; filed: GitHub #1 / #2 |
| qa-blast-prewarm | 6 | stale fixture; fixed: lethal blast coverage |
| seethrough-apc-behind-truck | 6 | stale fixture; fixed: actual camera obstruction |
| seethrough-companion-clean-z05 | 2 | measurement flake; fixed: geometry masks at production depth |
| seethrough-companion-clean-z1 | 2 | measurement flake; fixed: geometry masks at production depth |
| seethrough-lamp-head-foreground-z05 | 1 | measurement flake; fixed: geometry masks at production depth |
| seethrough-lamp-head-foreground-z1 | 2 | measurement flake; fixed: geometry masks at production depth |
| seethrough-scripted-convoy | 4 | stale assertion; filed: GitHub #4 |
| Additional bike closest-zoom assertions | 2 | stale assertion; filed: GitHub #4 |

All 2190 row keys, metric hashes, actual backend/quality and failure dispositions are in [the audit](matrix-final.json). Every original failed row has committed JSON and a contact sheet under `../failures/`. Passed-row images were pruned only after their metrics and pass/fail records were saved.
