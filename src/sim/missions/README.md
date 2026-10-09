# Mission integration

`MissionDef` is validated before a level attaches it. Objectives form a graph through
`start` triggers (`start`, or all/any completed objective IDs). Completion/failure
triggers cover volume edges, filtered kills/events, timers, item sets, actor health,
vehicle/escort destinations, and named boolean/count conditions. A choice group
cancels its alternative paths. Cheats complete exactly one active objective.

The controller runs in `SimPhase.missions` after combat. Gameplay ticks pause during
briefings, retry/results/progression screens and cinematics. A cinematic counts
presentation ticks separately; any action input can skip after 30 ticks. Watching
and skipping apply the same final actions exactly once, without advancing physics,
weapon timers or mission timers. `level.completed` carries the result snapshot.

Mission scripts spawn named actor groups, publish `migration.started`, rebuild the
E10 district tier/collision/nav, toggle gate colliders, set time-of-day, grant items,
set checkpoints/markers, and display radio lines/cinematics. Migration consumers
(E07) and vehicle/escort consumers (E09/E08) use the typed events and mission signals;
the mission engine does not implement their AI or movement. E19–E24 own encounter
content, mission-specific hazards, tutorials and balancing atop the campaign graphs.

A checkpoint snapshots graph state and serialized entities/racks. Restore retains
run totals and dead scripted bosses, restores full player HP, escorts and charges,
and shifts remaining timer deadlines to the current tick. Reached snapshots are
in-memory. `loadLevel(id, {checkpoint})` prefers a reached snapshot in the current
level; on a fresh load it reconstructs an authored checkpoint through the structural
graph walk. That test control is not a gameplay completion/balance playthrough.
Death restores automatically on the E04 respawn event. Other failures show Retry.
Result Continue publishes `progression.requested`; E13 owns upgrade/loadout choices.

The additive test API is version 1.5. `missions` exposes copied `state()`, `begin()`,
`retry()`, `continue()`, `signal()`, `collect()`, `setState()`, `count()`, `checkpoint()`
and `restore()`. `missions.load(def)` is restricted to `mission-sandbox`. Headless tests
use the same `missionControls(world)` factory as the browser, including teleport and
actor damage through the normal combat damage service. The existing root
`cheats.completeObjective(id?)` delegates to the controller and errors without a mission.

`src/ui/MissionUI.ts` consumes live sim state for tracker distance, minimap pins,
clamped direction arrows, subtitles, briefing/retry/results and progression handoff.
`ObjectiveMarker` renders the actual world anchor. Camera blending reuses E02's
Bruno View adaptation. World/player visuals continue through the asset registry;
scenario actors retain existing code placeholders until their gameplay view owner
integrates them. No assets or dependencies are required for subtitles or mission UI.

Campaign adapters use `SimWorld.spawnMissionActor` to attach real vehicle bodies,
E11 devices, destructibles and item pickups to the graph's actor IDs. For an
`interact` trigger with `actor`, the actor's device must complete; authored mission
devices use `instant: false`, require standing still, and retain the existing 25%
damage interruption notch. Bare interaction triggers keep the L1 story semantics.
`drive` checks the actual driver and vehicle position; `exit: true` also requires
the player to leave the vehicle inside the destination after driving into it.
`escort` checks the living follower, `destroy` checks the spawned object's health,
and `items` receives E11 pickup transactions. Device, vehicle and prop events also
retain actor filtering in `event` triggers.

`hold` requires continuous living player occupancy and resets progress when the
player leaves its ring. Defend steps combine this with a target-death failure.
L3's `deadline` is global: `state.deadlineTicks` counts down during gameplay only.
A timeout emits `mission.failed`, opens Retry, then restores the checkpoint's
remaining ticks plus 3600 (60 s). Ordinary restores get no grace; repeated retries
do not accumulate grace on the stored checkpoint. The tracker shows the countdown.

Headless real-input checks: `npm run sim -- --level L2 --policy newbie --seeds 20`.
`--level all` runs L1–L6; `--seed` selects the first seed, `--ticks` caps each run,
and `--out` selects the JSON report. Reports include completed, time, deaths,
failures by reason, objective timeline, active objectives and stalled positions.
The CLI delegates L1 to its existing story bot and reuses its navigation Walker
for later levels. The later policies drive with throttle/steering, enter/exit at
doors, stand at devices, follow objectives, and attack destructibles/threats.
`newbie` makes decisions every 250 ms and skips 15% of attack decisions.
`npm run test:levels` runs three seeds per level and returns nonzero if any fail;
it asserts completion only, without padding times to match acceptance bands.
This is a foundation check: missing routes/encounters and finale content still
need the subsequent content lanes. A graph completion does not prove every epic.

## L5 "Aftermath" (E23, `def.l5`)

`levelFiveMission` (`src/levels/L5/mission.ts`) is a three-step graph, `emerge` (stand at the cellar brace 1.0 s) -> `look` (state `accounted`: all five
survivors found) -> `metro` (state `sheltered`), with checkpoints `outside` and `survivor-1..5`; no timer, no fail on a death. `LevelFiveAftermath`
(`LevelFiveAftermath.ts`) owns everything else in `state.l5`: the courier starts in the walled cellar yard (L4 end loadout), steps out at `l5-out`, ten
silent seconds later the objective appears, each survivor (`src/data/l5.ts`, `l5Survivors`) is a hidden pedestrian (not a human target) until the courier
stands within 1.7 m of its ring for 1.0 s (or presses E there); a sign of life (`l5.cue`: position + subtitle, every 7 s, only within 25 m) is the only guide.
Found survivors follow (`src/sim/outbreak/Survivors.ts`: slots behind the courier, 3.8 m/s, "Wait!" at 10 m, crouch within 8 m of an infected) and are
ordinary biteable humans: lane C's grab/bite/turn lifecycle decides their fate; `losses()` records dead and turned ones. The shutter (`l5.shutter`) closes
when the courier is at the Metro foot and every living follower is within 15 m, or 10 s later; followers within 15 m are `sheltered`, `level.completed`
carries their keys in `result.survivors`, and `CampaignUI` stores them in `campaign.survivors` for L6. `gloom` (1 -> 0.5 of the preset sun, monotone) is read
by `GameView`. Bots: `src/debug/bot/LevelFiveBot.ts` (`complete` tours the five rings by the cheapest permutation and waits for the group), runner
`tools/sim-runner/l5Bots.ts`, probes `tools/l5/*` (`map.ts` walkability, `bot.ts`, `trace.ts`, `batch.ts` for short tuning runs, never a gate).

