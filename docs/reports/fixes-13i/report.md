# Fixes 13i — #101 / #102 / #104

- #101: boss reaches combat range in **5.85 s**, with objective, moving marker and minimap pin; combat settings unchanged.
- #102: guarded exit snapshot and retreat formation fixed. Stairs are reachable; the driver gap-steering fault is corrected.
- #104: visible HUD console E, L7 escort leash and visible-enemy WASD/attack defence implemented.
- **L6 fists passed:** male seeded save, **298 s**, one death, no skips/assists, real L7 handover. [Proof](evidence/l6-fists-summary.json).
- **L10 real-input credits NOT reached:** driver aborted at boss after 30.1 s without detected progress, alive at 90 HP. Approved fallback; sim campaign reaches credits with zero L10 deaths.
- **Green:** remote **2,406 passed / 9 skipped**, smoke **31/31**, typecheck and lint. [Validation](evidence/final-validation.json).
- Red-first regressions, exact errors, live boss proof and approved driver limitation: [investigation](investigation.md).
- Implementation **fd7640f5f** and evidence committed locally; browser released; no tuning, merge or deployment.
