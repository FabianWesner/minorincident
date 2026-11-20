# s187-megamoves: Mega signature moves

## Implementation

Committed in `b13a9f47`, `7c8f6676`, and `4c52b512`.

- Added ranged debris throws, living infected throws, a leap slam, and a pursuit roar for the Mega Alpha. The roar rallies infected in range; the Mega call reuses the existing roar event. Charge range and wind-up were increased, with a wall collision stun. Existing close-range slam and grab remain.
- Mega prop throws select a movable prop within 3 m or create a concrete chunk from the ground. The chunk uses the existing debris pool and has a blocking collider for its eight-second lifetime. Living infected can be thrown when within 3 m of the Mega and the courier is 8–30 m away. These share the throw cooldown. Thrown infected take fall damage; projectile hits damage and knock down the courier.
- Added Scene Lab scenarios for zombie throw, leap, and roar under `tests/scenes/l10-mega-moves/`.
- Reused existing rig poses and audio cues. New leap and roar clips are not present; their motion uses procedural timing/effects. No new rig assets were authored.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused infected AI and save-progression tests: passed after selecting an existing throw cue.
- Remote `npm test`: reached the 240 s budget without a reported test failure. The specified fallback passed: local `npm test` (27 files, 106 tests, 183.9 s) and remote `tests/engine/l4-contact.test.ts` (1 test).
- `npm run qa:threat`: completed with 0 fail flags. L10 skilled and passive routes both hit the audit tick budget; the required L10 acceptance rows therefore remain unverified.
- An isolated `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` reproduced the skilled tick-budget outcome at 1,800 simulated seconds. The passive hold window was measured (468.86 attacks/minute, L10-11 PASS); its tick-budget is the documented observation cap. The partial run's only fail flag was `PARTIAL_LEVEL_SELECTION`, so it is diagnostic and does not replace the full gate.
- Regression comparison, isolated L10 native skilled audit, seed 1, LOW: baseline `bc57d840` completed in 1,120.02 s with 2 deaths and 559.99 total damage taken; `02fd92c6` hit 1,800 s at the Mega objective with 41 deaths and 4,526.12 total damage taken. These are whole-route totals, not Mega-only DPS or the requested HIGH walk measurement. The new behavior fails skilled route completion and needs balance/behavior investigation.
- A native replay attributed only 45 damage to the Mega directly; ordinary infected dealt most damage. Restricting the existing encounter-wave request to its original rage phase did not change the 41-death outcome. Typecheck, lint and the focused infected AI test passed after that correction.
- Enforced at least 180 ticks between Mega special starts. Typecheck, lint and the focused infected AI test pass. The isolated LOW L10 audit still hit the skilled tick budget with 44 deaths; the spacing correction alone does not resolve the regression.
- Pursuit now selects leap and charge outside the close-range brain. The focused AI test checks automatic leap selection at 20 m and the 179/180-tick spacing boundary; it passes. The isolated LOW L10 audit still timed out at the Mega objective with 44 deaths after this change.
- Corrected the Mega throw marker's range cap from 25 to 35 m to match its projectile. Typecheck and lint passed; visual verification of a throw beyond 25 m remains open.
- The ground fallback is covered by the focused AI test, including creation of a concrete chunk with a blocking collision group and a thrown event. Typecheck and lint pass. Browser review of its appearance and landing remains open; the finite debris pool can be exhausted.
- Headless WebGL2 Scene Lab under `tools/e2e-lock.sh`: all nine original HIGH scenarios and the zombie throw, leap, roar and debris throw HIGH/LOW scenarios passed their configured gates. [Contact sheet](moves-contact-sheet.jpg) contains their six-frame HIGH and LOW strips; visual review remains for the orchestrator. The debris scenario records active and recovery stages; these isolated scripted scenes do not establish hit, dodge or DPS criteria.

## Open acceptance items

- Review ground rubble appearance and landing in browser QA, including behavior when the debris pool is full.
- Measure debris-hit damage and the L10 HIGH walking death count before and after; the requested ~25% DPS ceiling is not measured.
- Confirm scripted sidestep dodges, damage/knockdown outcomes, and all move telegraphs in browser QA.
- Complete L10 skilled and passive threat audit routes.
