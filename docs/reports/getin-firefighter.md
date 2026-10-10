# Story NPC protection (PO 2026-10-10)

## Cause and fix

The L1 firefighter is a civilian allied fighter. Bites use the civilian outbreak lifecycle, bypassing ordinary HP damage. At the infected cap, a completed bite calls `Outbreak.kill`: it sets `civilian.state = finished` without setting HP to zero or adding an infection component. `L1Story.firestation` previously considered only missing entities, zero HP, infection, or a missing civilian component when deciding whether a colleague should take over. A finished civilian with a stale allied combat target therefore remained the invitation actor: the dead ally no longer updated its target, and the story skipped its waving pose while that target was set. It rendered as a corpse beside the objective.

`storyProtected` now derives immunity from checkpointed mission state. Damage can shove these actors, but cannot remove HP or create a lasting knockdown. Both civilian grab paths, completed bites, infection, immediate conversion, and explosive collapse honor the same predicate. The infected brain still hunts and attacks them, but a resisted bite does not consume a conversion slot. No pressure, spawn, weapon, or ordinary ally balance values change. L1 also recognizes an existing `finished` actor when recovering the invitation. Its firefighter holds the bay post while fighting. Crowd separation yields to protected actors that hold a post, keeping the invitation beside the entry while explicit damage can still shove it.

## Six-level audit

| Level | Required actors | Protection ends | Coverage |
| --- | --- | --- | --- |
| L1 | Depot clerk; lab technician; “Get in!” firefighter | Clerk returns inside; delivery choreography completes (technician may then become Patient Zero); bay entry completes | `story-protection.test.ts` L1; `l1-firefighter.test.ts`; night browser capture |
| L2 | Six fire crew including the scripted truck crew/driver; trapped rescue crowd with scripted cries | Market doors open, finishing the ride/door-forcing beat; crew and freed civilians then use ordinary survival rules | `story-protection.test.ts` L2, each crew/crowd entity |
| L3 | Sergeant (first designated squad officer), briefing/armory speaker and fallback caller | Fallback call completes the station beat; squad losses remain possible afterward | `story-protection.test.ts` L3 |
| L4 | Quartermaster at the machine gun interaction | Machine gun is taken | `story-protection.test.ts` L4 |
| L5 | Dale, Rosa, Mr. Okafor, Mia, Sam at their cue/interaction spots; Marcus at the metro shutter | Each survivor is found (escort losses remain possible); lookout's shutter closes | `story-protection.test.ts` L5, each entity |
| L6 | Marcus, shelter organizer/retreat caller; opening medic (Rosa or fallback medic) and injured patient | Marcus reaches the closing exit gate; opening speakers finish the calm shelter before first breach | `story-protection.test.ts` L6, each entity |

Truck/bus drivers have no separate damageable driver NPC: their ride is scripted/kinematic. L3 dispatch, L4 radio calls, and remaining objective anchors use mission radio/environment actors rather than vulnerable speakers. Ordinary civilians, soldiers, officers, firefighters, and optional rescued followers keep their existing balance and loss rules.

The six audit tests enumerate the actual spawned actors, exercise both grab paths, cap-kill and transforming bite events, direct infection/conversion, all seven damage types, and explosive collapse. They also end each beat and prove the same actors become infectable again.

## Validation and visual review

- Before fix: the new cap-bite and legacy-corpse regressions both fail against main `a93caf8f`; evidence: `test-results/getin-firefighter/before-main.txt`.
- Final typecheck, lint and production build: passed.
- Final remote unit + story regressions: **130 files / 453 tests passed** (445 unit tests + six-level audit and both firefighter cases), `test-results/getin-firefighter/final-unit-regressions.json`.
- Remote smoke simulations: **6 passed**. Headless browser smoke, all configured projects: **26 passed**.
- Headless level browser suite and E19 verifier: final route checks still running.

The game-camera night capture (`test-results/getin-firefighter/firefighter-fight.png`) was inspected: the red-helmet firefighter is upright at the open bay beside the yellow interaction ring; “Get in!” is visible above the crowd. Blue night shadows and warm street/fire-bay lighting are present. The courier is in the foreground, and living infected surround the post; the crowd partly obscures the firefighter’s legs but he is clearly standing. The companion snapshot (`night-pressure.json`) records 70/70 HP, `calm`, the night preset, and 11 living infected within 10 m. The test first idles the courier away for 60 simulated seconds under ten spawned attackers, then verifies the original actor, bark, fighting and actual bay entry. No infected are removed to obtain the image.
