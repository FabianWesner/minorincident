# s202 — burn the fields

## Status

Partial implementation; the requested feature is not complete. This report records the implementation state as of 2026-11-20.

## Completed

- Added an initial deterministic L10 corn-cell state with a seven-second burn interval and snapshot/restore methods. Mission checkpoints capture and restore this state, retaining scorched cells on retry. Spread now reaches neighbouring crop blocks at 10 m spacing; the approximation still needs validation against real field footprints and road boundaries.
- The clipped flamethrower stream and existing spreading fire zones now ignite nearby authored corn cells; a loaded-level test confirms a fired stream ignites an authored crop block. Crop cells are sourced only from `veg.corn-block` placements, so roads and other surfaces are excluded.
- Added an isolated unit test for deterministic spread, exclusion of a non-crop placement, and restoring a saved state. It does not exercise real road geometry. A loaded L10 checkpoint test verifies restoration of a scorched cell.
- Molotov pools, burning field cells, active fire hazards, and burning destructible props apply a 35 DPS, four-second burning status to infected and the courier. Focused tests check an infected entering a landed molotov pool, upgrading a weaker burn to 35 DPS, taking damage, and catching fire immediately during a brief ground-flame crossing. Focused tests, lint, and TypeScript checks pass.

## Additional PO requirements (2026-11-20)

- Pointer aim now controls the stream range (2–8 m); non-pointer input retains full reach. The stream deposits five-second fire patches along its clipped path. A focused simulation test covers short pointer damage and patch placement plus full touch reach. Long pointer range and visual captures still need verification.
- Initial bounded ignition state for authored trees, bushes, hedges and wooden fences burns for ten seconds and records char. Pooled fire effects, instance tinting and checkpoint state are connected but unreviewed; vegetation state is exposed in the hazard debug snapshot for capture verification; A loaded L10 test verifies that a ground fire patch ignites an authored vegetation object and a checkpoint restores its char; a unit test verifies the cap. Vegetation ignition respects L10 route centerlines, with an isolated barrier test. Authored L10 crown instances now disappear after charring; tree flame sources now use the authored placement height. Verify both visually, including canopy flame placement. The L10 dead-tree and small-bush variants are included after a capture probe exposed their omission. Actual road surface coverage, wider prop coverage and requested captures remain open.

## Open

- Crop instances use district-prefixed IDs matching field cells and have an unreviewed collapse and tint hook for burning and scorched states. The existing pooled flame, smoke, ember and light renderer now receives up to 24 visible burning cells. Review and measure the resulting appearance and performance.
- Add flammable tall grass and hay/straw coverage across levels. Grass is generated from lawn bounds in `Grass.ts`; no named hay/straw asset appeared in the searched definitions and level code. Companion and follower movement has an initial local field-fire detour; the local detour now rejects paths through adjacent burning cells in a unit test. Verify moving routes in a loaded level. Verify burning field-cell actor interactions in a loaded level. A loaded-level test verifies lethal direct hazard fire sets ash-death state. A focused simple-difficulty test verifies courier burning status and damage from a ground hazard. Verify all fire sources and rendered ash heaps end to end; hazard fires currently retain their existing direct damage as well as the status. Existing fire-immune infected still reject burning in the shared status system, an exception to the requested universal rule that remains unresolved under the no-stat-tuning constraint.
- The flamethrower HUD role hint now mentions burning dry fields. Nearby field fire uses one intensity-scaled existing flamethrower loop and an ignition cue when it starts. A crackling-specific loop, repeated patch catches, and listening review remain open.
- A loaded-level sim probe found a connected patch at (1035, -38). HIGH and LOW WebGL2 captures show spread and eventual dark flattened corn, but lack a convincing fire front, visible ash heaps, and verified smoke. See the latest visual review below. LOW `/private/tmp/s202-connected-low-spread.png` recorded quality `low`, 36 scorched and one burning at tick 1083; I inspected it and found soft, pale flame patches and orange-lit corn. Whole-field HIGH WebGPU frame timing remains pending.
- Run the current revision through the full `npm run qa:threat` gate with zero flags. The remote full `npm test` timed out; the prescribed local suite and remote L4 fallback passed, as recorded below.
- Spread links and direct ignition now reject crossings of authored L10 route centerlines; an isolated barrier test covers both. Verify actual road surfaces and other barriers in a loaded level, and live-save resume.

### Latest visual review

A fresh HIGH WebGL2 zoom-1 sequence after reducing flame overlap and glow is at `/private/tmp/s202-connected-high-{ignite,spread,stubble}.png`. I inspected all three: the first shows bright ground flames among standing corn, the second shows pale flame clusters and widespread orange illumination, and the third shows dark flattened crop. The simulation recorded 36 scorched cells and one burning at tick 1086. The flames still read as soft glowing patches rather than a convincing wild fire front; smoke and ash heaps are not evident. This is not a visual pass and is not the requested WebGPU performance measurement.

A HIGH WebGL2 tree probe at `/private/tmp/s202-tree-burning.png` recorded object `D-CURE/prop.tree:1` in `burning` state, but the image shows bright flames and a large dark shape without a recognizable burning tree. It is not acceptable proof of canopy flames or the later charred appearance. Short and long cursor-length captures also remain outstanding.

## Validation

| Check | Result |
| --- | --- |
| `npx vitest run tests/engine/combat.test.ts` (including `tests/helpers/s202-field-fire.ts`) | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| Remote `sh tools/remote/run.sh "$PWD" -- npm test` | First failed budget at 163/150 and 48/45; lane assertions were consolidated without removal. Rerun collected 150/150 and 45/45, then timed out at 245.7 s without reported test failures. |
| Threat QA L10 batch | Remote `npm run qa:threat -- --levels=L10` completed skilled route, passive window and kiting probe; 0 L10 passive flags. Exit 1 carries the expected `PARTIAL_LEVEL_SELECTION` flag; the full current-revision gate remains unrun. Receipt: `test-results/s202-threat-l10/README.md`. |
| Threat QA L1–L4 batch | Skilled routes complete; aggregate reports only `PARTIAL_LEVEL_SELECTION`. Raw L4 skilled flags include `wave/breach-north:WAVE_FIRST_ATTACK_OVER_20_SECONDS`; the aggregator gates passive wave flags and intentionally does not include this skilled wave flag. Receipt: `test-results/s202-threat-l1-l4/README.md`. |
| Threat QA L5–L7 batch | All skilled routes complete. A controlled pre-lane simulation comparison produced no L5 flags, establishing a lane regression. A temporary change excluding ambient hazard fires from burning made the remote L5 retest complete its skilled route and all follower seeds with zero L5 flags; only partial selection remained. That exclusion has since been removed to honor the PO requirement that lingering fire applies burning regardless of source, so that retest is stale. The current all-fires revision was rerun: the skilled route and follower seeds completed, but L5 again has three threat flags (kiting zero attacks/min and landed hits, and skilled search below 3 attacks/min), plus partial selection. Receipt: `test-results/s202-threat-l5-all-fires/README.md`. This conflict remains unresolved. Receipt: `test-results/s202-threat-l5-fix/README.md`. Original aggregate flags: L5 kiting 0 attacks/min, 0 landed hits, and skilled search below 3 attacks/min, plus partial selection. L6/L7 report no passive flags; L5/L7 follower pace has zero flags. Receipt: `test-results/s202-threat-l5-l7/README.md`. |
| Threat QA L8–L9 batch | Both skilled routes complete, zero passive flags; aggregate contains partial-selection flag only. Receipt: `test-results/s202-threat-l8-l9/README.md`. |
| Timeout fallback | Local `npm test` passed: 27 files, 106 tests, 166.3 s. Separate remote `tests/engine/l4-contact.test.ts` passed in 166.21 s. Remote full suite is not green. |
| Commit | Explicit paths staged after filesystem access was restored. |
