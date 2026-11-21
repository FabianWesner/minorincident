# s212g2 L10 finale progress

## Changes

- Motorbike knock-off now depends on an infected heavy, Alpha, or Mega attacker. Ordinary infected hits no longer eject the rider based on damage amount alone. The L1 bicycle is unchanged; L10 speed remains 1.25×.
- A severe speed loss from at least 6 m/s now dismounts the motorbike rider as a solid-impact crash; light scraping does not.
- Roadblock devices stay non-interactable until their safe-admitted encounter cohort is cleared, leaving E available to dismount the rider. Cleared gates still open automatically.
- The HUD shows “Back on the bike · Press E” (or the touch action) when the nearby parked motorbike is within 10 m after a nearby roadblock opens.
- Vehicle tests cover an ordinary 20-damage hit that keeps the rider mounted, a brute hit that dismounts, and a simulated high-speed solid impact.
- Main's `06d3a402` overpass test fix is included: the central, north, and south throw crates are all movable props, and these three IDs are exempt from the solid-decor expectation.

## Route receipt

[`pacing.json`](pacing.json) and [`roadblocks.json`](roadblocks.json) are the current LOW/HIGH ordinary-input probes after the solid-contact crash change. The probe passed 82/98 checks. Both tiers recorded 0/4 complete roadblock sequences.

| Tier | Hangar to gate | Longest activity gap | Bike ticks | Deaths |
|---|---:|---:|---:|---:|
| LOW | 406.5 s | 17.4 s | 7,748 | 3 |
| HIGH | 293.4 s | 16.1 s | 1,883 | 8 |

Both tiers miss total time, cadence, and the required ride/fight/remount/cross loops. The quarantine cohort now follows the courier's approach lane like the other paced groups; its spawns still use director-safe admission. HIGH recorded first-gate arrival, fight, and opening, but no remount and crossing. Incomplete sequence state resets on death, so zero final fields do not imply no intermediate attempts. LOW and HIGH were run separately against the same source hash (41/49 checks each). Typecheck, lint, and mission interactions passed; the full gates must be rerun after this source change.

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

After the solid-contact change, LOW death traces showed repeated Mega hits during first-roadblock recovery. A trial suppressing remount when a visible Mega was within 12 m of the bike reduced deaths from seven to one, but left the bike at the first gate (2,833 riding ticks, 0/4 loops, 306.8 s hangar to gate). It was discarded; the recovery policy needs a way to create space from Mega and return, rather than merely declining to mount.

Camera geometry for the next composition: `View` follows the courier with a 25° perspective camera at radius 19 m, azimuth 45° and polar 54°. At ground level the screen-right axis is proportional to `dx - dz`; thus the second tent trial at (3510, 47), relative to the beat-8 courier at approximately (3503.6, 54.4), lies about 9.7 m to screen right before perspective and object extent. It is outside the roughly 7.5 m half-width of the 16:9 target plane. A scene must be designed around the player's actual lane and camera-facing silhouette, with collision footprints and sightlines checked together. The roadblock walls use fixed colliders (`Physics.addBlocker`), so the crash query's kinematic exclusion does not exclude those walls.

The first hospital tent and its opening trigger were moved to (3500, 50), using the follow-camera projection and measured beat-8 courier position. The updated native HIGH sheet shows a lit open tent entrance at beat 8, with the courier beside its flap; it still needs staged silhouettes and a wider hospital composition. Beat 7 still has no readable underpass. Typecheck, lint, the solid-placement audit (0 offenders), and the world-systems and mission-interactions tests passed for this placement. Full route and final gates remain to be rerun.

A native HIGH underpass trial moved the existing model to (3387, 50), aligned its piers and lamps, and halved its vertical scale to bring the deck into the follow camera while retaining approximately 2.6 m clearance. Beat 7 still showed only a clipped edge and emergency lamp, with no readable overhead span. The trial was discarded. The asset and occlusion/frustum treatment need a camera-aware redesign rather than another translation or scale adjustment.

A native HIGH LOD probe at beat 7 placed the underpass at (3387, 50) for diagnosis and reported `lod0`, not `culled`, while the player was at (3391.68, 54.70). The previous image's missing deck therefore cannot be attributed to whole-instance frustum culling; its projected geometry and possible per-pixel occlusion need inspection. The diagnostic placement was reverted. Separately, forced-dismount parking searches up to 3 m but `canInteract` accepts 1.5 m, so some legal parking results require walking closer before E; any wider interaction must also preserve wall reachability and avoid snapping the bike through solids.

Fallen motorbikes now accept E within 3.1 m after the knock-off lockout, covering the 3 m crash parking search. Recovery checks the path against fixed walls and chooses the mounting position near the bike; automatic stand-to-mount retains the original 1.5 m range. A focused vehicle fixture passes recovery at 2.5 m and rejects it through a fixed wall. Typecheck and lint pass. Dynamic and kinematic obstacles are excluded by the shared reachability query and need further verification; the paired route and final gates have not yet been rerun for this change.

The extended fallen-bike recovery path check now includes dynamic and kinematic solid bodies as well as fixed walls. Focused vehicle tests verify all three block recovery; typecheck and lint pass. The paired route was rerun: LOW and HIGH still record 0/4 loops, and the full gates remain outstanding.

A Mega lure trial moved the dismounted bot away from the fallen bike until the visible Mega was at least 10 m from it, then allowed recovery within 20 m. LOW completed with one death and 6,363 bike ticks but still no complete loops (380.1 s hangar to gate). HIGH had 11 deaths, 1,937 bike ticks and no loops (342.7 s). The trial was discarded because HIGH exceeds the death limit and neither tier achieves the ride sequence.

The roadblock HUD now shows “Back on the bike” while the bike cannot yet be interacted with, and adds the E/touch instruction only when the vehicle interaction is available. This avoids prompting E from outside recovery range or during the lockout. Typecheck and lint passed; a native interaction review remains open.

A LOW trial aligned each roadblock's fixed collider center with its admitted encounter lane. The first gate recorded arrival, dismount, fight and opening with zero deaths, but no remount; the bike was left at that gate (3,022 riding ticks), hangar-to-gate was 304.5 s, and the activity gap reached 22.7 s. The barrier shift was discarded because it did not produce the ride loop and worsened pacing and activity.

After a nearby gate opens, the bike hint now remains visible at up to 40 m and shows a screen-relative direction and distance until E/touch interaction is available. This makes a bike left during a fight easier to locate; it does not solve the bot's recovery policy. Typecheck and lint passed; native HUD review remains open.

A hospital figure trial admitted two ordinary `infected.runner` actors at the tent entrance through `director.safe` while the courier approached. The native HIGH beat-8 frame still showed no figures; a follow-up entity probe showed at least one had already chased away from the tent (x≈3457, over 40 m away) before the event. The trial was discarded. A staged animation and release needs to preserve normal infected behavior after the reveal and keep the director's safe admission and persistence rules.

The hospital now safely admits two existing runner figures off camera at the tent. They sway under the existing emergence hold until 90 ticks after beat 8 and the tent opening, then return to ordinary pursuit; passing x=3512 also releases them. Dead actors leave the hold without being removed. The updated native HIGH sheet shows one figure inside the lit opening and another at the entrance. Typecheck, lint, and mission interactions passed; route, threat and other final gates need rerunning. Beat 7 still lacks a readable underpass.
