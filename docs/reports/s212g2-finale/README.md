# s212g2 L10 finale progress

## Changes

- Motorbike knock-off now depends on an infected heavy, Alpha, or Mega attacker. Ordinary infected hits no longer eject the rider based on damage amount alone. The L1 bicycle is unchanged; L10 speed remains 1.25×.
- A severe speed loss from at least 6 m/s now dismounts the motorbike rider as a solid-impact crash; light scraping does not.
- Roadblock devices stay non-interactable until their safe-admitted encounter cohort is cleared, leaving E available to dismount the rider. Cleared gates still open automatically.
- The HUD shows “Back on the bike · Press E” (or the touch action) when the nearby parked motorbike is within 10 m after a nearby roadblock opens.
- Vehicle tests cover an ordinary 20-damage hit that keeps the rider mounted, a brute hit that dismounts, and a simulated high-speed solid impact.
- Main's `06d3a402` overpass test fix is included: the central, north, and south throw crates are all movable props, and these three IDs are exempt from the solid-decor expectation.

## Route receipt

[`pacing.json`](pacing.json) is a native ordinary-input LOW/HIGH probe on the current change set. Both routes complete (LOW 1 death, HIGH 8), but the objective is not met:

| Tier | Hangar to gate | Longest activity gap | Bike ticks | Roadblock sequences |
|---|---:|---:|---:|---:|
| LOW | 299.5 s | 19.9 s | 172 | 0/4 |
| HIGH | 275.7 s | 18.1 s | 1,569 | 0/4 |

The overall probe passed 82/98 assertions. Both tiers miss 420–540 s and 45–75 s beat cadence; both fail all four roadblock sequences. The game remains 120–165 s short of the route target, and the ride segment remains far below 40% of hangar-to-gate time. Subsequent bot-only remount/leash and barrier-hold trials increased deaths and stalled the route; those policies were discarded and are not in the source tree. [`roadblocks.json`](roadblocks.json) contains the six-tier/roadblock receipt (all eight incomplete).

After narrowing heavy dismounts to hard hits (20+ damage), an instrumented LOW probe showed 7,288 bike ticks and a 334 s hangar-to-gate leg, but three deaths and 0/4 complete roadblock loops. An additional recovery-at-bike bot rule was tested and discarded: it caused a 2,418 s full route with 34 deaths and still 0/4 loops. That failed experiment is absent from the source. The checked-in route receipt predates the final heavy-hit threshold edit and should be treated as diagnostic evidence, not a passing final receipt.

## Verification

- `npx vitest run tests/engine/vehicles.test.ts tests/engine/save-progression.test.ts tests/nightly/mission-interactions.test.ts --maxWorkers=4` — pass, 9 tests.
- `npm run lint` and `npm run typecheck` — pass.
- `npm test -- --maxWorkers=4` — pass, 27 files / 106 tests.
- `npm run typecheck` and `npm run lint` — pass after the final source edits.
- `L10_STORY_SKIP_ROUTE=1 node --import tsx/esm tools/qa/l10-story.ts` — pass, 64/64 fixtures.
- `node --import tsx/esm tools/qa/solid-placement-audit.ts` — pass, 0 offenders.

Remaining gates/evidence: `npm run verify -- E32` failed before starting because the sandbox denied a tsx Unix-socket bind; remote `npm test` could not run because there is no healthy runner, and `scale.sh add` could not reach its API because DNS/network access is blocked. The earlier two-shard threat audit merged to 0 flags before the final crash-handling and hard-hit threshold changes and must be rerun. `qa:vehicle-campaign-motion` and the native HIGH capture both failed at browser-pool startup (`listen EPERM` on local control port 4329). Hospital silhouettes/framing, underpass readability, the native contact sheet, and full route pacing/ride sequences remain open; no visual-readability claim is made here. Main is still one commit ahead; the sandbox denied writes to `.git` metadata during the merge attempt, so its test fix was integrated manually but the branch ancestry was not merged.

## Continuation: merged main and native evidence

Main `06d3a402` was merged after sandbox restrictions were lifted. The remote `npm test` passed (105 passed, one skipped, 209.1 s); `qa:vehicle-campaign-motion` passed. The current two-shard threat audit merged with 0 fail flags; L10 skilled completed and passive reached its tick budget with 0 passive flags. Mission interactions passed.

The [native HIGH zoom 1 contact sheet](native-finale-high.jpg) was captured with the ordinary-input bot and inspected. Beat 0 shows the courier outside the hangar; 1 shows the mounted motorbike at the intersection; 2 shows a fight in an open area; 3 shows the billboard edge; 4 shows an empty road; 5 shows empty ground; 6 shows Mega and a crate on the road; 7 shows cornfield with no readable underpass; 8 shows open ground and a lamp with no readable hospital; 9 shows a crate and corpse. The courier is on foot from beat 2 onward. The requested scenery and ride loop remain open.

A camera-placement trial moved the underpass from z=95 to z=55 and the tents to z=61–63, with their colliders and hospital trigger moved alongside them. A second native HIGH capture reached all ten beats, but beat 7 showed only an overhead edge and pier, and beat 8 showed only a cropped tent roof. The trial was discarded: merely shifting the existing structures does not compose the scenes around the camera, and the next design must address framing and route geometry together.

A further trial centered the underpass at (3393, 55) and moved the first tent to (3510, 47), updating their collision and trigger positions. The HIGH event capture still clipped the deck at the top and left the tent mostly offscreen. This placement was also discarded. Camera projection and the live event position must be used to compose the next attempt.

A current LOW ordinary-input probe after the hard-hit change completed with three deaths, 334.1 s hangar to gate, 7,288 bike ticks and 0/4 recorded sequences. Its [transition diagnostic](low-bike-diagnostic.json) shows repeated remount/dismount cycles near x=2995 and x=3259, followed by the bike being left at the convoy. Incomplete sequence state resets on death, so the final zero fields do not mean the bot never attempted any part of the sequence. The bot's visible-threat remount rule can remount during a lull before the roadblock cohort is cleared; a recovery design needs to account for the gate state and preserve combat mobility.

Two LOW bot trials were discarded. Suppressing remount while the nearby gate remained closed produced zero deaths but only 2,787 bike ticks: the bot fought onward and left the bike before the gate opened. Returning toward the bike during visible-threat lulls still produced only 2,787 bike ticks and two deaths. Neither completed a roadblock loop. Gate-state awareness alone does not solve recovery; the fight path and recovery objective must be coordinated.
