# s240 · L6 shield heavy damage feedback

## Cause

The two helmeted actors are the L6 hatch-front `infected.riot` shield bearers. L6 retains their existing 600 HP. A frontal army-MG round is deliberately reduced to 18% damage: `14 × 0.18 = 2.52 HP`. On the 64 px high-quality infected bar, that moves the red fill only `64 × 2.52 / 600 = 0.27 px`, so the bar looks stationary even though HP decreases. The earlier L6 role mismatch (an armored football actor wearing the riot-cop variant) was already fixed; the current problem is that real shield-chip damage has no minimum visible health-bar movement.

## Change

Shielded infected now use the existing damage-chip overlay already used for arena bosses. A tiny HP loss leaves a minimum 3 px white chip beside the red fill for 18 ticks (0.3 s). Frontal shield hits also retain their existing sparks, recoil, `SHIELD STRAIN · CHIP` callout, and 90-tick shield-break window. Flank and rear hits keep full damage. No L6 counts, spawn code, or enemy stats changed.

## Receipts

- `tests/engine/combat.test.ts` — the existing riot-shield combat case now checks that axe, handgun, shotgun, and army-MG damage reduces health and can down a shielded infected from both front and back. Existing distance/angle and frontal MG shield-break checks remain in this case.
- `tests/engine/l4-contact.test.ts` — the existing production health-bar test models a 600 HP riot and a 2.52 HP MG chip, then asserts that the damage-chip mesh is present. The underlying red fill delta is subpixel.
- Focused verification: `npm test -- --run tests/engine/combat.test.ts -t 'damage modifiers: shared riot shield'` passed; `npm test -- --run tests/engine/l4-contact.test.ts -t 'every contact archetype interrupts approach/lure'` passed; `npm run typecheck` and `npm run lint` passed.
- `npm run test:unit` passed locally: 105 tests across 27 files. The requested remote invocation did not run because no healthy Hetzner runner was available.
- `npm run qa:threat` hit its 600 s command budget before the full stage list completed (exit 124). The same untrimmed audit completed via `node tools/qa/run-threat-sharded.mjs --single`: **823.7 s, 0 fail flags**; receipt: `test-results/qa-threat/README.md`.
- Earlier physical L6 high/low counter receipts in [`fix73-g/L6-gate.json`](../fix73-g/L6-gate.json) and [`fix73-g/L6-final-counter.json`](../fix73-g/L6-final-counter.json) report production 600 HP shield fronts, 90-tick breaks, downing by ordinary aimed input, and visible shield-break sparks plus both red bars. The source capture PNGs referenced there are not present in this checkout.

## Open

- A fresh high-tier capture at the reported exit platform and a physical weapon-by-weapon L6 exit/tunnel run remain unverified. The headless capture attempt could not start the browser pool because this managed sandbox denied its `127.0.0.1:4329` bind (`listen EPERM`).
- The requested remote unit run could not start: `tools/remote/run.sh` reported no healthy Hetzner runner. Local full unit suite passed instead; the remote acceptance remains open.

