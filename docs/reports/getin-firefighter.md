# Story NPC protection (PO 2026-10-10)

## Cause and fix

The L1 firefighter is a civilian allied fighter. Bites use the civilian outbreak lifecycle, bypassing ordinary HP damage. At the infected cap, a completed bite calls `Outbreak.kill`: it sets `civilian.state = finished` without setting HP to zero or adding an infection component. `L1Story.firestation` previously considered only missing entities, zero HP, infection, or a missing civilian component when deciding whether a colleague should take over. A finished civilian therefore remained the invitation actor and rendered as a corpse beside the objective.

`storyProtected` now derives immunity from checkpointed mission state. Damage can shove these actors, but cannot remove HP or create a lasting knockdown. Both civilian grab paths, completed bites, infection, immediate conversion, and explosive collapse honor the same predicate. The infected brain still hunts and attacks them, but a resisted bite does not consume a conversion slot. No pressure, spawn, weapon, or ordinary ally balance values change. L1 also recognizes an existing `finished` actor when recovering the invitation.

## Six-level audit

| Level | Required actors | Protection ends | Coverage |
| --- | --- | --- | --- |
| L1 | Depot clerk; lab technician; “Get in!” firefighter | Clerk returns inside; delivery choreography completes (technician may then become Patient Zero); bay entry completes | `story-protection.test.ts` L1; `l1-firefighter.test.ts`; night browser capture |
| L2 | Six fire crew including the scripted truck crew/driver; trapped rescue crowd with scripted cries | Market doors open, finishing the ride/door-forcing beat; crew and freed civilians then use ordinary survival rules | `story-protection.test.ts` L2, each crew/crowd entity |
| L3 | Sergeant (first designated squad officer), briefing and armory speaker | Fallback begins; squad losses remain possible | `story-protection.test.ts` L3 |
| L4 | Quartermaster at the machine gun interaction | Machine gun is taken | `story-protection.test.ts` L4 |
| L5 | Dale, Rosa, Mr. Okafor, Mia, Sam at their cue/interaction spots; Marcus at the metro shutter | Each survivor is found (escort losses remain possible); lookout's shutter closes | `story-protection.test.ts` L5, each entity |
| L6 | Marcus, shelter organizer/retreat caller; opening medic (Rosa or fallback medic) and injured patient | Marcus reaches the closing exit gate; opening speakers finish the calm shelter before first breach | `story-protection.test.ts` L6, each entity |

Truck/bus drivers have no separate damageable driver NPC: their ride is scripted/kinematic. L3 dispatch, L4 radio calls, and remaining objective anchors use mission radio/environment actors rather than vulnerable speakers. Ordinary civilians, soldiers, officers, firefighters, and optional rescued followers keep their existing balance and loss rules.

The six audit tests enumerate the actual spawned actors, exercise both grab paths, cap-kill and transforming bite events, direct infection/conversion, all seven damage types, and explosive collapse. They also end each beat and prove the same actors become infectable again.

## Validation and visual review

Pending final runs.
