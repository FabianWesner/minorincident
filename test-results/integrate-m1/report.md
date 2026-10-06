# M1 integration

Merged lane order: E12, then E11, E09 and E15 (remaining lanes pending). Shared hubs retain additive systems, lifecycle hooks and event/API contracts.

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
