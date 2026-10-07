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

The initial short version completed in under 90 seconds and did not satisfy AC03. It was expanded with real encounters and objective travel; the criterion was preserved and no bot idle delays were added. Defense objectives require clearing all their actual infected waves as well as protecting the evacuation area. The shared browser/Node newbie policy samples ordinary controls every 250 ms.

Main was merged again in `39bdd545`, including the Bruno-derived vehicle handling and faster combat. The first complete 60-run battery on that handling passed every calibration criterion:

| Policy / forced route | Completed | Median time | Maximum deaths | Median time left |
| --- | --- | --- | --- | --- |
| Complete / supermarket | 20/20 | 312.09 s | 0 | 407.91 s |
| Complete / park | 20/20 | 295.85 s | 0 | 424.15 s |
| Newbie / alternating routes | 20/20 | 355.93 s (5:55.93) | 0 | 364.07 s |

Complete-route medians differ by 5.49%. Every complete run records at least nine runovers and three obstacle smashes; peak concurrent infected is 12 across all 60 runs. A fresh full verification rerun also covers the final route broadcast, production HUD countdown, portrait phone evidence and corrected legacy deadline fixture.

## Additional fixes and evidence

- The parked sedan registers a navigation blocker while empty and clears it on native entry. The bot steps away from the conservative navigation box beside an angled chassis, avoiding the browser park-route stall.
- The final patient follows ordinary escort navigation. Walking inside the destination volume gathers the patient through the gate from either arrival direction.
- First sedan entry announces both route alternatives. The production HUD shows the L3 deadline before the objective text; other levels retain their tracker text.
- Browser evidence includes both full routes at time scale 2, four named photo spots per route, a matching W0 Main Street comparison, and a 390×844 phone view. Long L3 tests retain screenshots and progress JSON instead of large network traces.

## Scope / outstanding art

No specification criterion was changed. No new models or dependencies were added. `decay.dropped-belongings` is missing; existing trash bags, benches, shopping carts and medical coolers provide temporary abandoned belongings dressing. The finished camp and paramedic exports were integrated by art-register and merged from main into this lane.

Validation totals and the final vision checklist are in `test-results/epics/E21/`.

## Known remaining regression

After the handling merge, `npm run test:levels` completes L1/L2/L3/L4/L5 on 3/3 seeds each (15/18 total), but L6 stalls at its `drive` objective on all three seeds. The fire engine remains near (13.215, 105.277), almost stationary and about 96.7 m from its destination. L3 changes only its own composition entry and layout copies; the L6 route still needs work in its owning lane.

E21 remains `in-progress` for the orchestrator's final vision review. Static screenshots cannot establish the duration/readability of attack telegraphs; that review remains explicit in `review.md`.
