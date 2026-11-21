# s212f L10 finale follow-up

## Changes and verified fixes

- Restored the dispersal electric gate to `z=1`, preserving the console approach from main commit `b54a8bea`.
- Added four encounter-backed roadblock gates. The gate colliders open after their cohort is admitted and cleared, and disable interaction after opening so they cannot be toggled closed without saved wall geometry.
- Rebuilt runtime roadblock geometry during checkpoint restore: a cold resume restores closed colliders and leaves already-open gaps passable. The save-progression fixture exercises both states in a fresh world.
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

The [roadblock receipt](roadblocks.json) now checks each sequence in order: mounted arrival, dismount, an actual hit on an infected, gate opening, remount, and mounted crossing. All eight tier/roadblock sequences fail. LOW records the first arrival, fight and opening but no subsequent remount and crossing; HIGH does not record a mounted arrival within the measured first-gate area. This confirms total riding ticks alone cannot prove the requested rhythm.

The bot now voluntarily dismounts for a closed gate rather than an x-coordinate alone. HIGH then recorded a first-gate arrival and fight, but still did not remount after it opened; LOW showed the same incomplete sequence. A broader 80 m return-to-bike trial was discarded: neither tier completed a roadblock sequence, and LOW's 496.6 s approach included a retry and a 146.1 s beat interval.

A 25 m remount search trial produced 56 LOW deaths and repeated mount cycles, so it was reverted. It also exposed a receipt bug: a remount before death could be combined with a crossing after checkpoint restore. Incomplete roadblock sequences now reset on death; the current paired route has zero completed sequences on both tiers.

A follow-up LOW policy waited for the parked bike's gate to open before searching up to 40 m for it. It was reverted: the route had nine deaths, a 314.2 s beat interval, and no completed roadblock sequence. Riding longer on retries did not produce the required rhythm.

## Visual evidence

The [native HIGH zoom-1 sheet](native-finale-high.jpg) was captured from the research checkpoint with ordinary bot input and inspected. The capture advances the render clock with the simulation: without that, an explosion's white flash persisted in every later frame. Beat 0 shows the courier beside a generator; 1 shows the mounted bike and sidecar at an intersection; 2 shows the quarantine gantry and a fight; 3 shows the billboard at the frame edge; 4 shows road without readable scarecrows; 5 shows a truck and combat; 6 shows the Mega holding the crate; 7 shows road, a pier and an emergency light without a readable underpass; 8 shows the edge of a tent but no readable opening or silhouettes; 9 shows a utility pole and building without a readable gate or searchlight. The sheet confirms that the route and framing still need work.

The capture now requires the billboard fall event for beat 3 and at least 15 ticks of hospital opening for beat 8. In the latest native HIGH run the events began at ticks 37200 and 43150; the captures were at 37260 and 43170. The hospital remained outside the readable frame even after its opening began.

A subsequent render-batch probe showed all three hospital tents culled outside the beat-8 camera frustum. Moving the first tent to (3505, 87) brought it into the loaded LOD and partly into the frame. LOW and HIGH still completed with one and eleven deaths; the opening is not yet readable. The opening now starts at tick 42990 in the native capture.

The tent asset contains canvas and animated flaps but no silhouettes. A further trial at (3498, 85) brought a flap to the top edge of the native frame, while leaving most of the opening outside it; that placement was reverted. The hospital needs a camera-aware composition and figures from an approved TRELLIS asset.

The existing `infected.runner` uses `inf.common-worker`, whose asset notes identify the PO-approved TRELLIS.2 suit zombie. The hospital cohort already contains runner slots, admitted through `director.safe`; these are candidate existing figures for a staged hospital encounter. Their current safe admission and pursuit behavior does not establish moving silhouettes inside a visible tent.

Moving the first tent from z=78 to z=85 and moving its opening trigger with it was also tried. The opening fired earlier, but the event-timed native frame still showed road and a sign rather than a readable tent. That placement was reverted; the placement-to-render path and occlusion need inspection before further coordinate changes.

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

A trial created the gates before encounter release and held admission until the rider was near and slowed or dismounted. LOW completed with one death in 393.4 s hangar to gate but a 142.6 s beat interval; HIGH completed with ten deaths in 270.5 s and still abandoned the bike before the first gate. The change was reverted because it did not establish the requested rhythm.

A second underpass mouth at z=55 was tried after the earlier native route went around the gate there. The subsequent native HIGH capture instead followed z≈92 at beat 7, and the added mouth was outside its frame. Beats 4–9 in that capture were also heavily washed out by a bright effect, preventing a reliable readability assessment. The extra mouth was discarded; the underlying exposure and route variability need investigation.

With the capture clock corrected, shifting the scarecrows closer to beat 4, moving the underpass 12 m forward, and restoring the hospital tents to z≈83–89 was tried. The native HIGH sheet still showed no readable scarecrows, only a pier and light at beat 7, and a tent edge at beat 8. The placement trial was reverted; a framing and set-piece design change is still needed.

A native beat-4 frustum probe found all seven field scarecrows culled; (3150, 100) projected inside the frame. An additional solid TRELLIS-derived scarecrow there appeared at the frame edge, but the HIGH full route then timed out with the Mega stuck in coarse pursuit near (3314, 43). The placement was reverted pending investigation of that route regression; the image also did not show a readable dry field.

The pursuit stall was beside the long x=3317 barricade: far coarse pursuit targets the courier directly, while its 80 m local grid cannot see the barricade's end. A fallback to authored nodes got the Mega past that point but initially sent it back toward stale nodes; a one-node fallback reached the complex, yet the HIGH run still timed out in the Mega fight with 25 deaths. Both fallback trials and the scarecrow placement were reverted; the result does not establish a safe pursuit fix.

The one-node fallback was subsequently tested without the experimental scarecrow. A focused unloaded-pursuit reproduction advanced from (3314, 43) past x=3400 while checking barricade contact; the previous direct pursuit remained at x≈3314 after 9000 ticks. Both full routes completed (LOW three deaths, HIGH ten). The altered LOW route used the northern overpass lane, exposing that the single crate was too far away; authored crates were added for alternate lanes and the probe requires a launch of one of those real props. The paired run recorded the northern crate on LOW and the central crate on HIGH. The new [pacing receipt](pacing.json) still fails the roadblock sequences and timing targets.

A native HIGH beat-7 diagnostic exempted `prop.l10-underpass` from the courier see-through cut between x=3360 and x=3405. At the normal route position (3390.8, 92.4), the sheet still showed only a pier and emergency light, with no readable overhead deck or darkness. The exemption was reverted; changing occlusion alone does not fix this framing.
