# s240 · L6 shield heavy damage feedback

## Current evidence and correction

The earlier claim that current L6 hatch fronts are 600 HP riot actors was wrong. The current production hatch spawn creates `infected.armored` at 240 HP, without the riot shield flag. A high-tier native L6 probe spawned two such actors and relocated them to the reported platform. Ordinary pointer input hit actor 57 with the handgun at tick 39: 240 → 230 HP, at y 4.6. The capture showed its red bar partly depleted. The second actor received no recorded hit before the probe timed out, so the cause of the PO's full-bar report is not yet established. The earlier riot evidence below is historical, not proof of the current hatch actors.

The armored front plate halves frontal damage and flank hits take full damage. To make small hits easier to read, the existing minimum-width damage chip now applies to armored actors as well as shield bearers and arena bosses. This is presentation only; it does not prove that all weapons hit at the reported position.

## Receipts

- `tests/engine/combat.test.ts` — the existing riot-shield combat case now checks that axe, handgun, shotgun, and army-MG damage reduces health and can down a shielded infected from both front and back. Existing distance/angle and frontal MG shield-break checks remain in this case.
- `tests/engine/l4-contact.test.ts` — the existing production health-bar test models a 600 HP riot and a 2.52 HP MG chip, then asserts that the damage-chip mesh is present. The underlying red fill delta is subpixel.
- Focused verification: `npm test -- --run tests/engine/combat.test.ts -t 'damage modifiers: shared riot shield'` passed; `npm test -- --run tests/engine/l4-contact.test.ts -t 'every contact archetype interrupts approach/lure'` passed; `npm run typecheck` and `npm run lint` passed.
- `npm run test:unit` passed locally: 105 tests across 27 files. Two unchanged remote invocations reached their 240 s limit (exit 124); the combat file passed in both, but neither full suite completed.
- `npm run qa:threat` hit its 600 s command budget before the full stage list completed (exit 124). The same untrimmed audit completed via `node tools/qa/run-threat-sharded.mjs --single`: **823.7 s, 0 fail flags**; receipt: `test-results/qa-threat/README.md`.
- Earlier physical L6 high/low counter receipts in [`fix73-g/L6-gate.json`](../fix73-g/L6-gate.json) and [`fix73-g/L6-final-counter.json`](../fix73-g/L6-final-counter.json) report production 600 HP shield fronts, 90-tick breaks, downing by ordinary aimed input, and visible shield-break sparks plus both red bars. The source capture PNGs referenced there are not present in this checkout.

## Open

- The high-tier platform probe recorded one handgun hit on the first of two native hatch actors; the second was not hit before the probe timed out. Full weapon/distance and tunnel coverage, visual review of the updated armored chip, and diagnosis of missed shots remain open.
- The remote unit suite timed out twice; the remote acceptance remains open.

