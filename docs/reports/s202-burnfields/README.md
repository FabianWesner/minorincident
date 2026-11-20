# s202 — burn the fields

## Status

Partial implementation; the requested feature is not complete. This report records the implementation state as of 2026-11-20.

## Completed

- Added an initial deterministic L10 corn-cell state with a seven-second burn interval and snapshot/restore methods. Mission checkpoints capture and restore this state, retaining scorched cells on retry. Spread now reaches neighbouring crop blocks at 10 m spacing; the approximation still needs validation against real field footprints and road boundaries.
- The clipped flamethrower stream and existing spreading fire zones now ignite nearby authored corn cells; a loaded-level test confirms a fired stream ignites an authored crop block. Crop cells are sourced only from `veg.corn-block` placements, so roads and other surfaces are excluded.
- Added an isolated unit test for deterministic spread, exclusion of a non-crop placement, and restoring a saved state. It does not exercise real road geometry. A loaded L10 checkpoint test verifies restoration of a scorched cell.
- Molotov pools, burning field cells, and existing hazard fires apply a 35 DPS, four-second burning status to infected and the courier. Focused tests check an infected entering a landed molotov pool, upgrading a weaker burn to 35 DPS, taking damage, and catching fire immediately during a brief ground-flame crossing. Focused tests, lint, and TypeScript checks pass.

## Additional PO requirements (2026-11-20)

- Pointer aim now controls the stream range (2–8 m); non-pointer input retains full reach. The stream deposits five-second fire patches along its clipped path. A focused simulation test covers short pointer damage and patch placement plus full touch reach. Long pointer range and visual captures still need verification.
- Initial bounded ignition state for authored trees, bushes, hedges and wooden fences burns for ten seconds and records char. Pooled fire effects, instance tinting and checkpoint state are connected but unreviewed; A loaded L10 checkpoint test verifies char restoration and a unit test verifies the cap. Vegetation ignition respects L10 route centerlines, with an isolated barrier test. Authored L10 crown instances now disappear after charring; verify this visually along with canopy flame placement. Actual road surface coverage, wider prop coverage and requested captures remain open.

## Open

- Crop instances use district-prefixed IDs matching field cells and have an unreviewed collapse and tint hook for burning and scorched states. The existing pooled flame, smoke, ember and light renderer now receives up to 24 visible burning cells. Capture, review and measure the resulting appearance and performance.
- Add flammable tall grass and hay/straw coverage across levels. Companion and follower movement has an initial local field-fire detour; verify moving routes and refine for multiple adjacent cells. Verify burning field-cell actor interactions in a loaded level. A loaded-level test verifies lethal direct hazard fire sets ash-death state. Verify all fire sources, courier damage and rendered ash heaps end to end; hazard fires currently retain their existing direct damage as well as the status.
- The flamethrower HUD role hint now mentions burning dry fields. Nearby field fire uses one intensity-scaled existing flamethrower loop and an ignition cue when it starts. A crackling-specific loop, repeated patch catches, and listening review remain open.
- Ignition uses spatial buckets to limit stream query work. A headless HIGH WebGL2 Scene Lab baseline attempt (port 5170, browser pool) loaded `scene-lab` rather than L10 and had no field-fire state. I inspected its image: the courier stands on a dark road with large dark patches and a distant crop edge; it does not show fire and is not valid evidence for the requested sequence. A second headless HIGH WebGL2 run loaded real L10 and fired with a six-metre pointer target. I inspected `/private/tmp/s202-real-ignite.png`: it shows the courier on open dark ground, a small isolated flame and light spot, and no readable stream or burning crop front. This fails the desired visual bar and is not the requested field sequence. A further HIGH WebGL2 zoom-1 run at authored crop cell (745, 62) produced ignition, 5 s and 15 s images in `/private/tmp/s202-field-{ignite,spread,stubble}.png`; I inspected all three. The initial frame shows intact corn and a tiny distant flame, the middle frame shows a dark mass with partially collapsed crop, and the last shows flattened but still brown foliage. Only one cell reached scorched state by tick 930; there is no visible spreading flame front or ash heap. This fails the requested wild field sequence. The renderer was rejecting non-entity field sources; that rejection is now fixed and requires a fresh capture. A repeat was queued through the browser pool but cancelled before admission after several minutes; no new visual result was produced. Capture and review LOW, fix and repeat HIGH, and measure whole-field frame time.
- Run full unit suite, `npm run qa:threat`, and remote `npm test`; verify skilled routes and resolve any failures.
- Spread links and direct ignition now reject crossings of authored L10 route centerlines; an isolated barrier test covers both. Verify actual road surfaces and other barriers in a loaded level, and live-save resume.

## Validation

| Check | Result |
| --- | --- |
| `npx vitest run tests/engine/field-fire.test.ts` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| Commit | Explicit paths staged after filesystem access was restored. |
