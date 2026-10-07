# E21 — L3 content lane

Status: in progress, pending final orchestrator vision review.

## Changes

- L3 owns a four-district road loop (Main / supermarket / park / Civic); other composition entries retain their coordinates. L3-only parking and corner furniture edits leave turning room for the real sedan. Parking, supermarket foot access and checkpoint dismount points are separate anchors.
- Reused the native vehicle steering, obstacle, blast, navigation, pickup and escort systems. Both Node and browser use the same L3 bot and ordinary controls. `--route market|park` forces the route in the Node runner; the browser API accepts `bot.start(policy, {route})`.
- Added Main Street emergency dressing, an actual heavy checkpoint wall, Riot and Sprinter route encounters, the Bloated blast alternative, a fenced evacuation camp, and `kit.evac-camp` / `npc.paramedic` placements by registry ID.
- Added playable evacuation fights: forecourt (seven two-infected waves), supermarket or park (18 waves), and checkpoint (24 waves), with finite medical caches. Each fight requires clearing the spawned infected and returning to its defense area. Route A adds a pharmacy supply detour; route B adds a park shelter rescue. The finale collects an actual escort at the hospital and leads them through the gate.
- The safe zone collapse spawns infected patients inside the fence, switches off Civic emissives, closes the perimeter and uses the existing campaign Continue handover to L4.
- All nine ACs have matching test tags. Browser tests run the real frame clock at time scale 2 and capture all four photo spots on both routes.

## Calibration

The initial short version completed in under 90 seconds and did not satisfy AC03. It was expanded with real encounters and objective travel; the criterion was preserved and no bot idle delays were added. The expanded newbie seed 1 completed in 336.95 s, with zero deaths, 116 kills, ten runovers, three obstacle smashes, 383.05 s remaining and peak 12 concurrent infected. Final 20-seed medians and validation totals are recorded below after completion.

## Scope / outstanding art

No specification criterion was changed. No new models or dependencies were added. `decay.dropped-belongings` is missing; existing trash bags, benches, shopping carts and medical coolers provide temporary abandoned belongings dressing. The finished camp and paramedic exports were integrated by art-register and merged from main into this lane.

Validation totals and the final vision checklist are in `test-results/epics/E21/`.
