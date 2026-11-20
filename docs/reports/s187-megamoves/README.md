# s187-megamoves: Mega signature moves

## Implementation

Committed in `b13a9f47`, `7c8f6676`, and `4c52b512`.

- Added ranged debris throws, living infected throws, a leap slam, and a pursuit roar for the Mega Alpha. The roar rallies infected in range; the Mega call reuses the existing roar event. Charge range and wind-up were increased, with a wall collision stun. Existing close-range slam and grab remain.
- Mega prop throws select a breakable prop within 3 m. Living infected can be thrown when within 3 m of the Mega and the courier is 8–30 m away. These share the throw cooldown. Thrown infected take fall damage; projectile hits damage and knock down the courier.
- Added Scene Lab scenarios for zombie throw, leap, and roar under `tests/scenes/l10-mega-moves/`.
- Reused existing rig poses and audio cues. New leap and roar clips are not present; their motion uses procedural timing/effects. No new rig assets were authored.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused infected AI and save-progression tests: passed after selecting an existing throw cue.
- Remote `npm test`: reached the 240 s budget without a reported test failure. The specified fallback passed: local `npm test` (27 files, 106 tests, 183.9 s) and remote `tests/engine/l4-contact.test.ts` (1 test).
- `npm run qa:threat`: completed with 0 fail flags. L10 skilled and passive routes both hit the audit tick budget; the required L10 acceptance rows therefore remain unverified.
- Browser captures were blocked before browser launch: the pool could not bind its local listener (`EPERM`), and the legacy lock path was denied permission to run `ps`. The required six-frame HIGH and one LOW JPG strips were not produced. No browser bypass was used.

## Open acceptance items

- Provide a ground rubble chunk when no breakable prop is within 3 m; the current throw path requires a nearby breakable prop.
- Measure debris-hit damage and the L10 HIGH walking death count before and after; the requested ~25% DPS ceiling is not measured.
- Confirm scripted sidestep dodges, damage/knockdown outcomes, and all move telegraphs in browser QA; produce the requested capture strips.
- Complete L10 skilled and passive threat audit routes.
