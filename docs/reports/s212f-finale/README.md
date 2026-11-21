# s212f L10 finale follow-up

## Changes and verified fixes

- Restored the dispersal electric gate to `z=1`, preserving the console approach from main commit `b54a8bea`.
- Added four encounter-backed roadblock gates. The gate colliders open after their cohort is admitted and cleared, and disable interaction after opening so they cannot be toggled closed without saved wall geometry.
- Fixed the overpass Alpha staging loop. It no longer resets the special every tick, the Alpha is staged beside the authored crate, and the authored attack ID is protected from combat interruption while the throw resolves. Incoming damage still applies.
- Tightened the overpass probe to require the `infected.prop-thrown` event for the authored crate entity during the beat-6/beat-7 interval.
- Corrected the mounted rear stair-climber damage multiplier and changed the pre-install Mega check to assert the 50% conventional damage floor.
- Moved the billboard into the forward view of its approach beat, moved the field hospital dressing closer to the route lane, and added an approach searchlight through the district layout pipeline.

## Route receipts

Both ordinary-input routes complete and the overpass crate throw is recorded on both tiers. The route cadence goal is still open:

| Tier | Hangar to gate | Beat intervals (s) | Longest activity gap | Deaths | Bike riding | Result |
|---|---:|---|---:|---:|---:|---|
| LOW | 299.3 s | 11.8, 73.6, 19.1, 16.5, 33.5, 23.0, 20.1, 37.4, 14.2 | 18.5 s | 0 | 3.5 s | Complete |
| HIGH | 300.7 s | 11.9, 74.9, 19.1, 16.5, 33.5, 23.0, 20.1, 37.3, 14.2 | 33.2 s | 16 | 2.6 s | Complete |

The overpass events are `alpha.grab-throw` launches of the authored crate at player x=3344.5 (LOW, tick 46631) and x=3344.4 (HIGH, tick 71700). These are actual prop launches, not telegraphs or living-missile events.

The native route still misses the 420–540 s hangar-to-gate duration and 45–75 s beat cadence on both tiers. HIGH also has a 33.2 s activity gap. The route bot rides only briefly before a hard hit knocks it off; a remount recovery experiment increased deaths to 33–38 and was reverted.

## Visual evidence

The required native HIGH zoom-1 contact sheet was not captured, so the set pieces have not been visually verified in this continuation. The prescribed `tools/e2e-lock.sh` command failed while the shared browser pool attempted to bind localhost:4329 (`EPERM`). The legacy `tools/e2e-lock.sh` path also failed because its host guard could not execute `ps` (`EPERM`). No native JPEG is included; the prior s212e sheet is not evidence for this revision.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/nightly/mission-interactions.test.ts` — pass.
- `L10_STORY_SKIP_ROUTE=1 node --import tsx/esm tools/qa/l10-story.ts` — 64/64 fixtures pass, including the rear stair-climber and Mega damage-floor assertions.
- `tools/qa/solid-placement-audit.ts` — 0 offenders.
- Sharded `qa:threat` merge — 0 flags (2 shards, merged receipt at `test-results/qa-threat/README.md`).
- `qa:vehicle-campaign-motion` — blocked at the same browser-pool startup failure.
- `sh tools/remote/run.sh "$PWD" -- npm test` — blocked: no healthy Hetzner runner is available, and the remote runner refuses the Mac fallback for `npm test`.

The objective is not complete. The route rhythm, ride/remount cadence, native contact sheet, vehicle campaign-motion gate, and remote unit suite remain open.
