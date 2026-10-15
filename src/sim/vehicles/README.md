# Shared L8/L9 armored transport

`vehicle.military-apc` uses the E09 driver input, safe capsule exit and transition presentation.
Its `veh.military-apc` shell selects the authored `unarmed` variant; the base shell is rendered
without gun/turret/muzzle if that variant has not arrived yet. Opaque set-piece cabs get
a glazed driver opening and E09 door pivots in presentation; authored translucent cabs bypass that fallback. Transport never grants a weapon.

Escape encounters guide each living survivor to the usual driver doorway (`doorX`,
`width / 2 + .55`, transformed by chassis yaw), then call `boardPassenger(carId, actorId)`.
The method rejects remote/moving/dead boarding. The existing crowd draws the step-in for
42 ticks; boarding finishes at 60 ticks. Calls do not cap the campaign roster to visual seats.
Use `groupBoarded(carId, completeRoster)` before departure; zero living survivors is valid.
`disembarkPassenger` checks navigation, a full capsule and other occupants, returning false
when all exits are blocked. Retry as other occupants finish exiting. Driver exit uses E09 `exit()`.

Before replacing L8, assign `save.transport = transfer(carId)` (owned actions,
settings and losses still belong to campaign). After L9 creates its empty simulation and
before it spawns population with conflicting IDs, call `restoreTransfer(payload, arrival, yaw)`.
The payload keeps vehicle/occupant numeric IDs, vehicle HP, survivor health/identity/infection,
weapon rack state and unlimited charges. The destination rebinds both the live combat
loadout and physics driver. Tick deadlines shift to preserve remaining times in the new level.
Vehicle snapshots/checkpoints own passenger lists and pending entry/exit progress.
The protected corgi boards through the same passenger lifecycle in the L8 escape;
departure waits for it without counting it in the rescued human roster. L9 restores
incoming occupants before creating a standalone companion, avoiding duplicate IDs.
L7's scripted bus keeps the corgi entity hidden aboard and carries its snapshot in
`MissionResult.companion`; L8 reserves that ID before population setup and resumes follow.
L9's durability and breakdown policy are added by L9-S1.

L9 floor policy (L9-S5, PO 10-13): `Vehicles.setFloorPolicy(id)` marks the mission APC. Durability still clamps to 0, but the
car stays driveable at 60% of the healthy top speed (`apcFloor.speedShare`, `VehicleBody.speedCap`), the interact/exit input is
ignored, and E09 smoking/burning/explosion never run (`state.floor`, `state.stage`). Cumulative stages at <=75/50/25/0% emit one
`vehicle.damage-stage` each; `state.stage` persists with the checkpoint snapshot, so a retry restores the stage without
replaying cues. Obstacle, parked-car and registered-wreck (`Vehicles.wrecks`, several boxes per logical id) contacts bill 10
per onset (`source: 'obstacle'`) with the infected separation rule. Other vehicles keep the E09 rules. The HUD shows
`Armor cur / max` and `Barely functional` at the floor (`vehicle-durability` panel).

Scene Lab pedestrians accept `{ "boardCar": "apc" }` and `{ "exitCar": "apc" }`.
`tests/scenes/l8-apc/transport.json` exercises the courier and a passenger at the game camera;
`tools/scenelab/l8-apc.ts` records the reviewed before/after set and renderer/CPU counters.
