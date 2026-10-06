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
