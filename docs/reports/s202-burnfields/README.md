# s202 — burn the fields

## Status

Partial implementation; the requested feature is not complete. This report records the implementation state as of 2026-11-20.

## Completed

- Added an initial deterministic L10 corn-cell state with a seven-second burn interval and snapshot/restore methods. Mission checkpoints capture and restore this state, retaining scorched cells on retry. Spread now reaches neighbouring crop blocks at 10 m spacing; the approximation still needs validation against real field footprints and road boundaries.
- The clipped flamethrower stream and existing spreading fire zones now ignite nearby authored corn cells; a loaded-level test confirms a fired stream ignites an authored crop block. Crop cells are sourced only from `veg.corn-block` placements, so roads and other surfaces are excluded.
- Added an isolated unit test for deterministic spread, exclusion of a non-crop placement, and restoring a saved state. It does not exercise real road geometry. A loaded L10 checkpoint test verifies restoration of a scorched cell.
- Molotov pools, burning field cells, and existing hazard fires apply a 35 DPS, four-second burning status to infected and the courier. A focused test checks an infected entering a landed molotov pool, upgrading a weaker burn to 35 DPS, and taking damage. Focused tests, lint, and TypeScript checks pass.

## Additional PO requirements (2026-11-20)

- Pointer aim now controls the stream range (2–8 m); non-pointer input retains full reach. The stream deposits five-second fire patches along its clipped path. A focused simulation test covers short pointer damage and patch placement plus full touch reach. Long pointer range and visual captures still need verification.
- Burning trees, bushes, hedges and wooden props, their persistent char, and the requested captures remain open.

## Open

- Crop instances use district-prefixed IDs matching field cells and have an unreviewed collapse and tint hook for burning and scorched states. The existing pooled flame, smoke, ember and light renderer now receives up to 24 visible burning cells. Capture, review and measure the resulting appearance and performance.
- Add flammable tall grass and hay/straw coverage across levels and companion pathing. Verify burning field-cell actor interactions in a loaded level. A loaded-level test verifies lethal direct hazard fire sets ash-death state. Verify all fire sources, courier damage and rendered ash heaps end to end; hazard fires currently retain their existing direct damage as well as the status.
- The flamethrower HUD role hint now mentions burning dry fields. Nearby field fire uses one intensity-scaled existing flamethrower loop and an ignition cue when it starts. A crackling-specific loop, repeated patch catches, and listening review remain open.
- Ignition uses spatial buckets to limit stream query work. Capture and review HIGH/LOW L10 sequences; measure whole-field frame time.
- Run full unit suite, `npm run qa:threat`, and remote `npm test`; verify skilled routes and resolve any failures.
- Spread links and direct ignition now reject crossings of authored L10 route centerlines; an isolated barrier test covers both. Verify actual road surfaces and other barriers in a loaded level, and live-save resume.

## Validation

| Check | Result |
| --- | --- |
| `npx vitest run tests/engine/field-fire.test.ts` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| Commit | Explicit paths staged after filesystem access was restored. |
