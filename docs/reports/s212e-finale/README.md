# s212e finale and motorbike

## Work completed

- Restored the L10 finale route, motorbike, sidecar, checkpoint migration, and QA tooling from the reverted merge.
- Fixed the resumed Mega regression. Older console saves can lack `l10-overpass-mega`; when the saved courier position is beyond the overpass, story update now records that one-shot beat as complete instead of re-staging the Mega there.
- Built and integrated the motorbike GLB and LODs, aligned the corgi's presentation to the sidecar socket, and made hangar cast spawning wait for navigation. Focused asset, vehicle and save checks pass.
- Key commits: `9f99e544` (resume fix), `3e1cfce4` (restoration), `17d3c793` (motorbike asset), `e2c5060c` (hangar streaming).

## Verification

| Check | Result |
|---|---|
| `npx vitest run tests/nightly/mission-interactions.test.ts` | Pass; unchanged test, including the console save resume case |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:unit` | Pass; 27 files, 106 tests |
| `sh tools/remote/run.sh "$PWD" -- npm test` | Pass on current code: 27 files, 105 passed and one skipped, 197.7 s. |
| `npm test` on current code | Pass on current code: 27 files, 106 tests, 108.2 s. |
| Full threat audit, two local shards and merge | Pass on code at `e2c5060c`: 0 fail flags; all skilled routes complete. Shards ran in 112.5 s and 132.6 s; merged receipt `test-results/qa-threat/README.md`. |
| `npm run verify -- E32` | Pass; per-change typecheck, lint, and 106-test gate |
| `SMOKE_WORKERS=1 E2E_UNITS=1 E2E_PORT=5215 SCENE_PORT=5216 npm run test:smoke` | Pass: six smoke tests and one public-build smoke test; 237.7 s |

## Pacing probe

The complete-route probe is saved in [pacing.json](pacing.json). It does **not** meet the requested pacing:

| Tier | Hangar to gate | Longest fight/story gap | Skilled route |
|---|---:|---:|---|
| LOW | 367.5 s | 15.6 s | Completed in 1397.7 s, six deaths |
| HIGH | 456.4 s | 19.8 s | Completed in 2091.1 s, 25 deaths |

LOW misses the 420–540 s hangar-to-gate target. Beat intervals in seconds are LOW: 11.8, 45.2, 113.4, 17.5, 24.5, 17.8, 11.1, 24.9, 34.5; HIGH: 11.4, 62.8, 14.7, 44.2, 24.4, 17.8, 87.5, 24.9, 102.1. Both miss the 45–75 s cadence. Further authored roadblock encounters are required; no player speed reduction was made.

An experiment adding three standard-infected cohorts was measured and discarded: LOW took 451.1 s with ten deaths and a 166.5 s beat interval; HIGH took 283.4 s with eight deaths. Both completed the full route, but neither met cadence and LOW exceeded the 20 s activity gap. More enemies alone do not establish the required ride, dismount, fight and remount rhythm.

The skilled bot now attempts to mount a nearby motorbike and dismount for nearby infected. A follow-up 1800 s route probe completed on both tiers, but recorded only 89/90 mounted ticks (LOW/HIGH). LOW took 295.3 s from hangar to gate with a 32.6 s longest activity gap; HIGH took 387.3 s with a 42.9 s gap. This is not yet the requested ride and remount rhythm or a passing pacing result. Typecheck, lint and mission interactions pass after this change; full gates must be rerun.

The subsequent ride trace showed voluntary dismounts near the starting bike on sight of a single infected. The bot now shoots its handgun while riding and voluntarily dismounts near the four roadblocks. LOW rode for 2,219 ticks and completed, but took 395.4 s with a 113.4 s beat interval and a 29.6 s activity gap. HIGH rode for 156 ticks before dismounting amid eight nearby infected, took 549.9 s to the gate and hit the 1,800 s limit during credits. Both still fail the pacing target; full gates are required after the bot change.

Additional LOW tracing shows the bike parked at approximately (3002, 76) while the courier fights around (3005, 83), then proceeds east. A wider remount search did not increase riding time. A trial stopping to clear visible enemies produced repeated mount/dismount cycles and failed the 1,800 s route budget; both trials were discarded. The QA trace now records the bike position to support a more robust fight-and-remount policy.

A prototype quarantine gate blocked the gantry opening until all encounter slots were admitted and cleared, then enabled an on-foot interaction. It was discarded after the LOW route probe completed with 23 deaths and took 615.1 s to the complex gate, including a 307.6 s final beat interval and a 23.5 s activity gap. A roadblock needs coordinated approach, enemy admission and recovery rather than simply blocking the existing route.

An unlocked on-foot gate in the gantry was also tried. With the bot directed to dismount and open it, LOW took 487.2 s but suffered 15 deaths and a 262.9 s beat interval. Without that bot direction LOW and HIGH took 615.1 s and 660.3 s respectively. The prototype was discarded: retries, rather than authored play, supplied the extra time.

The LOW route probe also shows the overpass throw is not reliable. At the original staging point the Mega was already performing a roar and the throw resolver rejected the request, while the script still marked the beat complete. A prototype that interrupted the prior move once and retried did not produce a throw before the courier left the area; the Mega moved away from the crate. That prototype was discarded. The overpass spectacle remains open.

Further tracing found the original staging point is blocked for the Mega and outside the view predicate, while the throw cooldown can still be active. A clear, visible staging point and nearby crate produced throws on both tiers, but the HIGH route then suffered 30 deaths and stalled before the complex; that staging change was discarded. A separate retry fix retains the one-shot flag across checkpoint restoration, preventing the original beat from being staged again after death. Save progression and the unchanged mission interactions test pass with that fix.

A second staging trial moved the throw farther east. LOW completed with four deaths and emitted `alpha.grab-throw` at x=3334; HIGH stalled before the complex with 26 deaths. The probe's current overpass assertion accepted a later `alpha.living-missile` at x=3355, so its pass does not prove the authored crate throw. This trial was also discarded.

The hospital-route investigation revealed an arena retry could resurrect a Mega killed after the ready checkpoint. The checkpoint seam now retains a later kill while preserving the captured position for a living boss; focused save and mission interaction checks pass. A subsequent HIGH route probe on current code stalled before the complex with 30 deaths at the 1,800 s limit, so it cannot verify the end-to-end effect or the skilled-route gate.

The HIGH stall trace showed the hospital cohort repeatedly downed and recovering before a checkpoint could commit. The checkpoint now requires every authored slot to be admitted and no member to be standing, while retaining downed bodies and their normal recovery. With a 2,400 s probe budget both routes completed: LOW 1,397.7 s with six deaths, HIGH 2,091.1 s with 25 deaths. Hangar-to-gate was 367.5 s LOW and 456.4 s HIGH; longest activity gaps were 15.6 s and 19.8 s respectively. LOW remains short of target, several beat intervals remain outside 45–75 s, and HIGH still exceeds the previous 1,800 s route budget. Typecheck, lint, save progression and mission interactions passed; the current threat, unit, smoke and E32 gates subsequently passed.

## Captures

The headless capture script runs through `tools/e2e-lock.sh` on ports 5215/5216. Its revised sheet teleports the courier and steps the simulation to load each location. Review: 0 shows road and an ambulance; 1 a medical building; 2 the quarantine gantry and effigies; 3–4 mostly empty road; 5 a road beside wrecks; 6 the Mega beside the courier; 7 an empty road with the courier outside the frame; 8 road and a bench; 9 dark road. The unrelated start objective remains on screen. These staged views do not show the actual story beats or ridden motorbike. Native gameplay captures and a proper sheet remain outstanding.

A separate HIGH zoom 1 diagnostic teleported the player to the parked motorbike, mounted with E and drove for 120 ticks. The simulation reported a mounted motorbike at 9.375 m/s and the corgi as its passenger. The frame was inspected: the rider and corgi are very small, a large translucent shape obscures them, and the early objective remains visible. This staged image is not an acceptable native route capture; it remains uncommitted, and the capture script documents its setup.

The headless `s212e-native-captures.ts` pass starts at the research checkpoint and advances the ordinary skilled bot, without teleporting after setup. Its HIGH zoom 1 sheet now records when each serialized story beat fires. At beat 1 the rider is mounted and the corgi's passenger ID equals the bike ID; both are small in frame. Review: 0 shows a crowded fight by an ambulance; 1 shows the bike at an intersection; 2 shows the gantry and effigies; 3 shows the courier and corgi on the road but no visible billboard; 4 shows them off road in haze; 5 shows combat and bodies near wrecks; 6 shows a fight and telegraphs but no visible Mega throw; 7 shows the courier and corgi on road, without a readable underpass; 8 shows road and a bench, not the hospital; 9 shows a building and fire, not a readable gate approach. The sheet is useful evidence of current framing, but does not demonstrate all authored story beats or a clear sidecar view. A better capture of the actual moments remains required.

## Remaining

The objective is not complete. Required follow-up: build clearable roadblocks and encounters that produce the 7–9 minute route and 45–75 s cadence on both tiers without relying on deaths; make the overpass throw reliable; capture and review the actual set pieces at HIGH zoom 1; rerun all gates after those changes. The latest 2,400 s route probe failed 12 of 86 checks, including pacing/cadence, overpass throw on LOW, idle arrivals, early Mega visibility, and two controlled combat checks.

The branch starts at `f9049d8b`. At handoff the shared local `main` has independently advanced to `152d5e3e`; this branch has not been merged with that newer state. The receipts above verify this branch, not the combined result with the newer main.

The authored motorbike now renders in the HIGH native sheet with the corgi seated in its sidecar; the subjects remain small at zoom 1. A LOW checkpoint-started riding frame also shows the seated corgi, with a large dark shape at the bottom of the image. The LOW teleport diagnostic produced a stretched skinned mesh, so that staged capture is not accepted as visual evidence.
