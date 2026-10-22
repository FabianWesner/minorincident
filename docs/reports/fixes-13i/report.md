# Fixes 13i — #101 / #102 / #104

- #101: existing Mega Alpha stages near the console after charge; live boss range ≤14 m in **5.85 s**, with objective, moving ring and visible minimap pin. Health/combat settings unchanged.
- #102: exit checkpoint waits for all living survivors; retreat guards keep one normal formation movement intent while defending. Exit stairs are reachable: the stall was driver steering into the gap, corrected without a game patch.
- #104: E reads the visible HUD console prompt; L7 driver follows drawn living survivors. Finale dodging uses visible enemies, remembered console position and ordinary WASD/attack input.
- **L6 fists passed:** male seeded save, **298 s**, one death, no skips/assists, all four steps and real L7 handover. [Summary](evidence/l6-fists-summary.json).
- **L10 real-input credits NOT reached:** zero deaths/skips/assists through charge and nearby boss; driver stopped alive at 90 HP: `No visible progress for 30.1 s; stopping without advancing the objective`. Browser released; approved 30-minute driver-limitation fallback applies. Sim campaign reaches credits with zero L10 deaths. [Evidence](evidence/l10-boss-arrival.json).
- Validation: typecheck/lint green; smoke **31/31**; full required remote on c11733d06 **2,403 passed / 9 skipped**. Latest-code remote including dodge policy is still running.
- Red-first regressions cover arrival, guarded checkpoint/15 deaths, guard drift, HUD serialization/prompts and driver steering. Exact earlier errors and all captures: [investigation](investigation.md).
- Implementation **fd7640f5f** and evidence committed locally; no horde, damage, speed or Alpha-health tuning, merge or deployment.
