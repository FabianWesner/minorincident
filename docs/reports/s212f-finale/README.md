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

On the subsequent hospital placement, new route checks recorded the billboard collapse and hospital opening on both tiers. LOW completed with zero deaths and HIGH with ten; hangar-to-gate remained 301.8 s and 271.2 s respectively. A native HIGH capture still did not show the hospital clearly, so the event checks do not establish visual readability.

The native route still misses the 420–540 s hangar-to-gate duration and 45–75 s beat cadence on both tiers. HIGH also has a 33.2 s activity gap. The route bot rides only briefly before a hard hit knocks it off; a remount recovery experiment increased deaths to 33–38 and was reverted.

## Visual evidence

The [native HIGH zoom-1 sheet](native-finale-high.jpg) was captured from the research checkpoint with ordinary bot input and inspected. The capture advances the render clock with the simulation: without that, an explosion's white flash persisted in every later frame. Beat 0 shows the courier beside a generator; 1 shows the mounted bike and sidecar at an intersection; 2 shows the quarantine gantry and a fight; 3 shows the billboard at the frame edge; 4 shows road without readable scarecrows; 5 shows a truck and combat; 6 shows the Mega holding the crate; 7 shows road, a pier and an emergency light without a readable underpass; 8 shows road and a sign without readable hospital tents or silhouettes; 9 shows a utility pole and building without a readable gate or searchlight. The sheet confirms that the route and framing still need work.

The capture now requires the billboard fall event for beat 3 and at least 15 ticks of hospital opening for beat 8. In the latest native HIGH run the events began at ticks 37200 and 43150; the captures were at 37260 and 43170. The hospital remained outside the readable frame even after its opening began.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/nightly/mission-interactions.test.ts` — pass.
- `L10_STORY_SKIP_ROUTE=1 node --import tsx/esm tools/qa/l10-story.ts` — 64/64 fixtures pass, including the rear stair-climber and Mega damage-floor assertions.
- `tools/qa/solid-placement-audit.ts` — 0 offenders.
- Sharded `qa:threat` merge — 0 flags (2 shards, merged receipt at `test-results/qa-threat/README.md`).
- `qa:vehicle-campaign-motion` — pass with E2E/scene ports 5221/5222.
- `sh tools/remote/run.sh "$PWD" -- npm test` — pass: 27 files, 105 tests passed and one skipped, 201.1 s.

The objective is not complete. The route rhythm, ride/remount cadence, and readable set pieces remain open. An earlier encounter release radius of 70 m was tested on LOW: the courier still bypassed closed gates, the route took 299.35 s, and the change was discarded.

A LOW trial directing the bot to approach and interact with closed gates after nearby threats cleared was discarded: it completed in 284.5 s hangar to gate with two deaths, 207 bike ticks and a 27.8 s activity gap. The bike was still abandoned and cadence remained outside target.

After the hard-hit motorbike change, a HIGH trial made voluntary dismount depend on actual distance to the roadblock rather than x distance alone. It was discarded: repeated deaths at the first gate restored the rider and bike to the preceding checkpoint, yielding 32 deaths, 816.9 s hangar to gate and a 2100 s route timeout. The first fight needs coordinated placement and recovery before this approach can work.

A LOW trial keeping the bot within roughly 12 m of the parked bike during nearby fights was also discarded. It caused repeated mount/dismount attempts and still abandoned the bike at the first gate; the route took 318.2 s with no deaths and a 19.8 s maximum activity gap.

After making roadblocks interactable along their face, a trial made the bot press the active gate after nearby threats cleared. It was discarded: LOW took 295.0 s with a 30.2 s activity gap and HIGH took 327.2 s with a 29.4 s gap. Riding remained 3540 and 1669 ticks respectively, with the bike still left at the first gate.

A second underpass mouth at z=55 was tried after the earlier native route went around the gate there. The subsequent native HIGH capture instead followed z≈92 at beat 7, and the added mouth was outside its frame. Beats 4–9 in that capture were also heavily washed out by a bright effect, preventing a reliable readability assessment. The extra mouth was discarded; the underlying exposure and route variability need investigation.

With the capture clock corrected, shifting the scarecrows closer to beat 4, moving the underpass 12 m forward, and restoring the hospital tents to z≈83–89 was tried. The native HIGH sheet still showed no readable scarecrows, only a pier and light at beat 7, and a tent edge at beat 8. The placement trial was reverted; a framing and set-piece design change is still needed.
