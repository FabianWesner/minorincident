# S212 — L10 finale route

Status: implementation is present in the worktree; acceptance remains open on pacing, capture, the remote unit run, global threat flags, and commit access.

## Implemented

- Replaced the corridor's generic pace checkpoints with Quarantine Gate, Convoy 7, Field Hospital, and the existing dispersal-complex checkpoint. Old `cure-pace-N` saves migrate to the nearest preceding valid checkpoint. Checkpoint HUD toasts use the place name.
- Added captioned, nonblocking story lines for beats 0–9. Reyes's dropped-handset recording repeats while the courier is in range; the medic recorder and convoy log are placed with the set-piece dressing.
- Added evac buses and cars, luggage, a child's bike, a quarantine gate, handset, downed line, crashed helicopter, burning convoy dressing, overpass rubble, hospital tents and fence, final barricades, sirens, and the complex searchlight tower. The overpass throwable is a movable district prop with its own physics collider.
- Re-stages the existing Mega at beat 6, invokes its existing `alpha.grab-throw` move, and calls the existing L10 encounter reservoir. The LOW and HIGH route probes both recorded the throw during beat 6.
- The existing L10 motorbike remains at the evac-road pickup point; the route test confirms it is the motorbike archetype and is parked at x=2800, z=45.
- Extended the native route probe with per-beat timing, gap timing, throw telemetry, and explicit pacing acceptance checks.

## Route measurements

Native ordinary-input LevelTenBot route, current final build:

| Tier | L10 result | Total L10 time | Deaths | Hangar to gate | Longest fight/story gap | Beat 6 throw |
|---|---:|---:|---:|---:|---:|---:|
| LOW | Complete | 1,173 s | 3 | 274 s (4:34) | 7.6 s | x=3343 |
| HIGH | Complete | 1,755 s | 14 | 382 s (6:22) | 11.7 s | x=3335 |

The 7–9 minute route target is not met: LOW is 146 seconds short of seven minutes and HIGH is 38 seconds short. The 45–75 second story-beat rhythm also fails. Beat offsets from the hangar exit were LOW `[0, 11, 74, 89, 106, 130, 149, 160, 185, 208]` and HIGH `[0, 11, 86, 100, 118, 143, 160, 171, 196, 298]` seconds. The maximum fight/story gap passes the 20-second target in both tiers.

The full threat audit reports L10 skilled complete and zero L10 threat flags. Its five aggregate acceptance failures are all L5 baseline findings:

- `L5/step/look:SKILLED_BELOW_ATTACKS_PER_MINUTE_3`
- `L5/step/look:SLOW_FOLLOWER:28`
- `L5/phase/search:SLOW_FOLLOWER:28`
- `L5/step/look:SLOW_FOLLOWER:31`
- `L5/phase/search:SLOW_FOLLOWER:31`

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- Focused L10/save/collision Vitest set — 14/14 pass.
- `node --import tsx/esm tools/verify.ts E32` — pass; 106 tests across 27 files, 188 seconds within the 240-second budget. The standard `npm run verify -- E32` entrypoint could not start because `tsx` was denied creation of its Unix IPC socket (`EPERM`).
- `node tools/qa/run-threat-sharded.mjs --single` — L10 skilled complete, zero L10 threat flags; aggregate has the five L5 flags listed above.
- `git diff --check` — pass.
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: no healthy Hetzner runner; `npm test` is ineligible for local Mac fallback. This was a runner-availability failure, not a 240-second test timeout.

## Visual evidence and open work

The native HIGH-zoom 10-frame sheet was not captured or reviewed. The headless capture script is at `tools/qa/s212-finale-captures.ts`, but the browser pool failed to bind `127.0.0.1:4329` with `EPERM`; no frames are claimed as reviewed.

The 7–9 minute route target and 45–75 second beat rhythm remain open. The full remote unit suite could not run without a healthy runner. The full audit has five L5 failures outside this L10 change. The implementation and this report are committed on the worktree branch. No branch was pushed or deployed.
