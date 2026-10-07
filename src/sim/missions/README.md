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
