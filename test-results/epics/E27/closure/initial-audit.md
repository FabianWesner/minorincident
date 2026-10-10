# E27 closure audit

Audited main / initial lane HEAD `baf1fb5a3848c18d1ad34cb8ce1c0fcc715c0f97` before implementation, 2026-10-10. A test tag alone is not a PASS: existing evidence and fresh validation are distinguished below. No performance or capacity budgets changed. AC14’s conflicting recovery wording was corrected, as documented below.

| AC | Initial audit | Evidence / missing behavior |
| --- | --- | --- |
| E27-AC01 | PASS (test exists) | tests/unit/data/explosions.test.ts; rerun pending. |
| E27-AC02 | PARTIAL | tests/sim/explosions.test.ts covers small/medium/large/mega, one-tick upward impulse and cover; incendiary/toxic class evidence incomplete. |
| E27-AC03 | PASS (test exists) | tests/e2e/explosions.spec.ts fixed-tick seven-beat pixel detectors; fresh run/captures pending. |
| E27-AC04 | PASS (test exists) | tests/sim/explosions.test.ts five-tank sequence and 14-tank cap; rerun pending. |
| E27-AC05 | PASS (test exists) | tests/sim/explosions.test.ts and tests/e2e/explosions.spec.ts cover body lift, parts, wreck and 20 s smoke; rerun pending. |
| E27-AC06 | PARTIAL | Gas-station test covers kill ratio/proximity; fuel-truck data and E22 test exist but five-second town tint and disabled-setting proof missing. |
| E27-AC07 | PASS (test exists) | tests/e2e/explosions.spec.ts per-frame reduced-flash pixels; rerun pending. |
| E27-AC08 | PASS (test exists) | tests/sim/explosions.test.ts target loss, wander and exact 720-tick lifetime; browser cloud test; rerun pending. |
| E27-AC09 | GAP | Skipped placeholder; unused gas variants staged to release extras in 04 §6. |
| E27-AC10 | GAP | Skipped placeholder; extinguisher burst absent. |
| E27-AC11 | GAP | Night fire light test proves brighter scene, not lower-third hue/brightness or siren phase. |
| E27-AC12 | GAP | Shared see-through hole dims puffs; no measured smoke/player contrast and opacity proof. |
| E27-AC13 | GAP | Stale placeholder says L6; current criterion requires L5 pair-plaza columns/shadow strips and is NOT deferred to E24. |
| E27-AC14 | PARTIAL | tests/e2e/explosions.spec.ts pool/cap recovery and tests/perf/explosions.spec.ts; rerun pending. |
| E27-AC15 | GAP | Skipped review placeholder; Scene Lab effects exist, required checklist H/collapse review absent. |

