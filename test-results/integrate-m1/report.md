# M1 integration

Merged lane order: E12, then E11, E09 and E15. Shared hubs retain additive systems, lifecycle hooks and event/API contracts.

## E12

Combined mission loading/checkpoint restore/UI/markers/events with E07 infected scenarios, crowd rendering, spawn frustum and pooled entity adopt/delete. API harness checks the union and delivered controls. Manifest union: 275 distinct IDs, retaining both sides’ field changes (including flashbang build script).

Eight newly tracked main sources lacked registration: helipad, helicopter, military truck, semi-trailer, assault rifle, fire axe, knife, rocket launcher. Registered source/scripts/LODs and rebuilt runtime GLBs through existing optimizeExports, preserving reference statuses and source art. Measured dimensions replace placeholder boxes. Helicopter retains authored 9.66 m rotor span; its animated node contract now describes rotors rather than empty skid-wheel placeholders. Road-lane assertion retains its threshold for road vehicles; an additional aircraft contract validates dimensions, rotor pivots and each LOD. This corrects a supporting test’s applicability without changing an epic acceptance criterion.

Supplemental production validation found existing crawler empty animated joints and three oversized building LOD2 bounds; newly registered exports validate. Those older findings are recorded in assets-validation.json and are outside the requested validation set.

## E11

Combined interaction spawn/control/UI/synchronization, hazard and pickup phases and component/event snapshots with E07 crowds and E12 mission loading. Binary npc.helicopter-pilot.lod1.glb regenerated from assets/npc.helicopter-pilot/model.glb with the merged optimizer; character LOD1 target leaves room for retained rigid parts. Manifest union remains 275; harmless rounded flashbang dimension conflicts retain the more precise canonical measurements, and source/build fields from both branches remain registered.

Existing E11 world.blocker.changed and noiseTarget hooks now feed E07's actual AI grid/brains. New regression checks cover overlapping blockers, alarm movement and expiry, and exact 35-damage enemy Bloated bursts alongside E11's reduced environmental blast damage. Pooled infected clear stale alarm targets before reuse. E12 tier/checkpoint transitions rebuild E11 collision/nav handles and invalidate freed cosmetic debris; added regressions preserve restored door/prop blockers and recreate debris in the new physics world.

## E09

Combined vehicle input routing, fixed physics phases, driver bot, rendering/readiness and damage causes with mission, interaction and infected systems. Scenario loader and API/harness retain all delivered controls. Manifest union stays at 275; retained canonical build/source fields and equivalent measured dimensions. Conflicting pilot LOD rebuilt again from canonical source with the merged optimizer.

E11 car-alarm noise now uses the common noise payload (plus its 10 s duration). Vehicle impacts on E11 light props use their authoritative damage/nav/debris lifecycle; native vehicle obstacles publish the shared blocker-change event. Attached E07 infected suspend their chase brain and pooled records clear attachment fields. E12 checkpoint/tier transitions rebind real vehicles, obstacle records and native handles, including pending explosion/recovery timer offsets. New regressions cover fence smashing/nav restoration, attachment anchoring and checkpoint vehicle/body ownership.

## E15

Combined render-clock hit stop, flash overlay, VFX settings/pools, spawn feedback and typed event probes with mission UI/markers, interactions, crowd batches, real vehicle models and lifecycle disposal. Both E07 windup payloads and E15 authored geometry payloads remain accepted; real AI windups are adapted and retired on completion/interruption, including the three-metre Bloated blast. Hazard explosions, ignitions/electricity, pickups and real vehicle ramming now drive the corresponding pooled feedback without simulation writes or RNG consumption.

Crowd hit pulses and five-part gore use per-instance shader attributes and a shared instanced stump-cap mesh, preserving E07's batching. Real E09 vehicles keep wheel/lamp/smoke/fire behavior and take blood masks on their existing per-car palette materials; the E15 isolated vehicle probe remains available for fixture IDs. New Node/browser regressions exercise these integrations and verify render stepping/settings preserve simulation hashes. Environment entities remain excluded from combat placeholder rendering, removed/restored entities retain lifecycle cleanup, and unique feedback materials are disposed.

Manifest union remains 275 IDs. E15's unrelated spec checklist-link edit is excluded as requested; only epic status is changed after verification.

## Current main

Merged main at 8b171c6 after all four epic merges. Its armored football, butcher, construction worker and firefighter standalone sources are retained byte-for-byte. Registered source/build/LOD paths, preserving the 275-entry manifest and each asset's reference status. Existing uniform sourceScale converts their authored heights (1.65–2.06 m) to the required 1.8 m runtime adult envelope while preserving proportions; runtime GLBs/LODs are regenerated through optimizeExports. No source art or spec criteria are edited.

Main moved again during final browser validation to bc20113. Added hazmat, nurse, skater and survivor-group source/build/LOD registrations and regenerated runtime exports with the same 1.8 m adult scale policy. Registered the survivor group's 11 additional authored color tokens in the shared palette; existing swatches and original source exports are unchanged. This satisfies the existing unknown-material validation rather than excluding findings. Vehicle blood copies now preserve imported material color/vertex colors and lighting. The active browser run is allowed to finish, then final validation restarts on this latest merge.
