# s202 — burn the fields

## Status

Partial implementation; the requested feature is not complete. This report records the implementation state as of 2026-11-20.

## Completed

- Added an initial deterministic L10 corn-cell state with a seven-second burn interval and snapshot/restore methods. These methods are not wired into mission checkpoints. The present spread cannot reach typical 10 m crop spacing during a seven-second burn and needs correction.
- Flamethrower impacts and existing spreading fire zones now ignite nearby authored corn cells. Crop cells are sourced only from `veg.corn-block` placements, so roads and other surfaces are excluded.
- Added an isolated unit test for deterministic spread, exclusion of a non-crop placement, and restoring a saved state. It does not exercise real road geometry or checkpoint restore.
- Focused test, lint, and TypeScript checks pass.

## Open

- Render flames, embers, smoke, orange surroundings, and stubble; connect crop instance visibility to fire state.
- Add flammable tall grass and hay/straw coverage across levels, actor damage/status interactions, and companion pathing.
- Fire crackle and patch-catch sound; pickup caption if needed.
- Capture and review HIGH/LOW L10 sequences; measure whole-field frame time.
- Run full unit suite, `npm run qa:threat`, and remote `npm test`; verify skilled routes and resolve any failures.
- Wire state into actual checkpoint capture and restore, and correct spread across real crop spacing.

## Validation

| Check | Result |
| --- | --- |
| `npx vitest run tests/engine/field-fire.test.ts` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| Commit | Explicit paths staged after filesystem access was restored. |
