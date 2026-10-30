[Nightly](checks/nightly.json) **PASS** (35 tests; L1→credits, content, sim budgets); [final checks](checks/status.json): `npm test` **107/107**, smoke **7/7**, `scene:gate` **48/48** green.
[Matrix](checks/matrix-final.json) on `165e05cd2`: **2,176 pass / 14 fail / 0 missing**; corrected probes **60/60**, reconciled **2,182 pass / 8 filed failures**.
All 14 new failures reproduced twice; nightly-28 original 2,157 and reconciled 2,178 prior passes covered, **0 unfiled regressions**; all 33 original failures now pass. Fix `c73c36789` on `lane/nightly-33`; temporary worktree removed.

| New failures | Classification | Action |
| --- | --- | --- |
| L7 elderly sole: 7 rows | Game render defect; actual shoe depth 0.5282 mm | [Filed N33-01](followups/N33-01-l7-sole.md); zero-sink guard retained |
| L10 title mist: 1 row | Game VFX coverage defect; 7 puffs below minimum 10 | [Filed N33-02](followups/N33-02-title-mist.md); minimum retained |
| L5 fire colour: 4 rows | Stale difference-mask probe | [Fixed geometry selection](evidence/probe-classification.md); all thresholds unchanged |
| Alpha silhouette: 2 rows | Stale dark-pixel outline probe | [Fixed geometry outline](evidence/probe-classification.md); all thresholds unchanged |
