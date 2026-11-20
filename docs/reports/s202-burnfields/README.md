# s202 — burn the fields

## Status

Partial implementation; the requested feature is not complete. This report records the implementation state as of 2026-11-20.

## Completed

- Added an initial deterministic L10 corn-cell state with a seven-second burn interval and snapshot/restore methods. Mission checkpoints capture and restore this state, retaining scorched cells on retry. Spread now reaches neighbouring crop blocks at 10 m spacing; the approximation still needs validation against real field footprints and road boundaries.
- Flamethrower impacts and existing spreading fire zones now ignite nearby authored corn cells. Crop cells are sourced only from `veg.corn-block` placements, so roads and other surfaces are excluded.
- Added an isolated unit test for deterministic spread, exclusion of a non-crop placement, and restoring a saved state. It does not exercise real road geometry. A loaded L10 checkpoint test verifies restoration of a scorched cell.
- Molotov pools, burning field cells, and existing hazard fires apply a 35 DPS, four-second burning status to infected and the courier. A focused test checks an infected entering a landed molotov pool and taking damage. Focused tests, lint, and TypeScript checks pass.

## Open

- Crop instances use district-prefixed IDs matching field cells and have an unreviewed collapse and tint hook for burning and scorched states. The existing pooled flame, smoke, ember and light renderer now receives up to 24 visible burning cells. Capture, review and measure the resulting appearance and performance.
- Add flammable tall grass and hay/straw coverage across levels and companion pathing. Verify burning field-cell actor interactions in a loaded level. Verify all fire sources, courier damage and ash deaths end to end; hazard fires currently retain their existing direct damage as well as the status.
- Fire crackle and patch-catch sound; pickup caption if needed.
- Capture and review HIGH/LOW L10 sequences; measure whole-field frame time.
- Run full unit suite, `npm run qa:threat`, and remote `npm test`; verify skilled routes and resolve any failures.
- Verify spread across actual field footprints and road boundaries, and validate live-save resume.

## Validation

| Check | Result |
| --- | --- |
| `npx vitest run tests/engine/field-fire.test.ts` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| Commit | Explicit paths staged after filesystem access was restored. |
