# Q-156 boarding guidance

Source fix checkpoint: 055ef7fa2 (`Hud.ts`, `objectiveText.ts`). Probe: `SCENE_PORT=4382 E2E_PORT=4381 sh tools/e2e-lock.sh npx tsx tools/qa/triage-a.ts boarding`.

Viewed `guidance.png`: the real L8 HUD shows `0/13 aboard` once. The missing list begins with Survivor 12; both the Find cue and minimap pin select Survivor 12. No overlapping UI or second count. `evidence.json` asserts the count appears exactly once, nearest passenger agrees across all three fields, and zero console errors. Diagnostic setup puts the last roster member nearest the vehicle to expose the former roster-order mismatch; the boarding request itself uses key E.
