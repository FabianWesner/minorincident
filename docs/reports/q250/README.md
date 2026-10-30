# q250 — only story weapons at a level start

Implementation: `469156c82` and `4848f7efe` on `lane/q250`. Original boundary reproduced from `094ec6b9f`; after captures use the implementation's source. All browser work used shared, headless pool contexts with Metal, on preview ports 4350/4351.

## Entry-path reproduction

The [before records](before/paths.json) and [after records](after/paths.json) contain live rack ids, selected weapon, HUD bar ids and death counts. The separate [legacy QA before](before/qa-legacy-rack-L2.json) and [after](after/qa-legacy-rack-L2.json) records cover the no-save reward/rack flow. Fixtures are synthetic saves, including a validated save with `completedLevels: 10`. `probe.ts` repeats the checks against a QA preview.

| Entry path | Before | After |
| --- | --- | --- |
| Menu level select: completed-L10 save → L2 | Wrong: handgun, pistol, machine gun, shotgun, rockets and molotov selectable | Bat + innate fists; right rack falls back to kick |
| Continue into L2 with a contaminated carried rack | Same leak | Bat + innate fists/kick |
| Fresh campaign L1 completion → L2 | Correct | Correct; bat retained |
| Replay L2 after finishing L5 | Wrong: handgun, machine gun and shotgun selectable | Bat + innate fists/kick |
| L2 checkpoint/death, before taking axe | Wrong rack survives death | Clean rack survives death |
| L2 checkpoint/death, after taking axe | Wrong guns survive alongside the axe | Axe and bat retained; axe stays selected; two real deaths/respawns exercised |
| Normal debug L2 level-list / L2 QA preset | Correct; level-specific presets masked the bug | Correct |
| QA start of L2 with L8 preset | Wrong: later guns and rockets | Bat + innate fists/kick |
| Direct QA L6 start with no save | Wrong: Combat's sandbox pistol, grenade and ground slam | Level preset's axe, bat, handgun and machine gun; no sandbox weapons |
| Legacy no-save QA L1 reward → manual rack → L2 | Wrong: chosen pistol and grenade overwrite the already-filtered level rack | The final assignment uses the same story clamp; bat + innate fists/kick |
| Carry selected handgun into L4 | Wrong: own-pickup withholding reset selection to bat and left later guns | Handgun remains selected; only bat, axe and handgun |

## Fix and carry-over

`campaignLoadout()` filters both sides before materializing the live loadout, preserving eligible rack order, baseline actions and abilities. Its weapon ids come from the same L1 unlock / L2, L3, L4, L5 and L7 pickup data the missions use. L5 street drops also count: an actually collected assault rifle survives the L5→L6 handover. Removed weapon slots, ammunition and charges are absent from the new loadout. A direct no-save QA start receives the filtered level preset rack without applying campaign stat upgrades. The legacy QA manual-rack handoff applies the same filter to its final assignment after loading.

The level's own pickups are not in its starting rack and become available when collected. L9's existing mandatory crash still leaves only the axe for L10. L10 resume checkpoints restore their acquired region weapons through the existing resume path.

The existing progression test has one data-driven L1–L10 case: exact weapon-set comparisons from a valid completed-L10 save and from sequential fresh handovers through `completeCampaignLevel()` (including the L9 crash), plus save reload and eligible selection checks. Expected starts are: L1 unarmed; L2 bat; L3 +axe; L4 +handgun; L5 +MG; L6 +shotgun and any collected L5 street rifle; L7 same; L8 +rockets; L9 same; L10 axe.

**L5 difficulty remains frozen:** the default bot fixture's exact LEFT `[axe, bat]` and RIGHT `[army MG, handgun, kick]` racks are asserted unchanged. Pickup coordinates, spawn options, weapon definitions and balance values are unchanged. A contaminated replay rack loses later weapons as requested.

## L2 bar vision review

[Before](before/l2-bar.png) · [After](after/l2-bar.png). Both full 1280×720 captures were opened and visually inspected. Before, the bottom-left bar visibly contains fists, bat, multiple firearms, rockets and a throwable. After, it contains only fists (1) and bat (2); the current axe objective has not yet been collected. Number-key probing 1–9 also confirms only the bat or innate unarmed actions can be selected after the fix. The subsequent axe/death probe confirms the axe becomes selectable only after collection and remains carried on respawn.

## Validation

- `npm test`: 110/110 passed (26 files); progression case includes all ten boundaries and the L5 rack freeze.
- `npm run verify -- E13`: passed; its receipt records successful typecheck, lint and the full unit suite.
- Browser reproduction/comparison: all probe assertions passed.
- `E2E_PORT=4352 npm run test:smoke`: passed, 6 QA tests + 1 public-build test, 137.0 s / 240 s budget. The default preview port was already owned by another lane, so this run used a private port.
- `SCENE_PORT=4353 npm run scene:gate`: **48/48 passed**, 0 known, 0 not run; 5.8 min. All 48 backend/scene/tier/zoom identities were also matched to the gate list.

Successful command-output excerpts and the implementation commit are recorded in [checks.txt](checks.txt); the E13 status receipt is [verify-E13.json](verify-E13.json).
