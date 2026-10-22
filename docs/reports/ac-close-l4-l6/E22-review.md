# E22-AC19 visual review — 2026-10-22

Reviewed the four fresh production campaign captures in `test-results/ac-close/l4-production/webgl-high/` individually at full resolution, plus the retained [phase sheet](../../../docs/reports/ac-close-l4-l6/l4-production-phases.jpg). Both requested quality tiers passed the capture/state/backend assertions. These are staged photo-anchor views of the actual campaign, not the legacy static QA scenes. High tier is the composition review; portrait low is an additional crop/tier inspection, not a claim that its fixed photo camera contains the whole army.

Reference comparison: opened `docs/reports/l3-flee-speed/after-boulevard.png` (historical actual L3 boulevard: ash, damaged shopfronts and attacking infected), the initial-drafts diorama references previously listed in the closure report, and the inherited current-base E07 `h-high.jpg`, `h-low.jpg`, `moves-a-1.jpg` and `bars.jpg`. The shared explosion sequences include the L4 collapse itself. Shared evidence is identified explicitly; a single still is not proof of a temporal blast stage or an entire attack telegraph.

## Scene scores

| Photo | Score | Observation |
| --- | --- | --- |
| l4-plaza-safe | 8/10 | Intact cream bus, organized queue, tents, registration desks, armed guards, medical supplies and clean paving read as an operating refuge; unlike the L3 reference, nobody is fleeing an active attack. |
| l4-war-line | 7/10 | Rifle/HMG soldiers, civilians, a living large Alpha with red facial cues, and many retained fallen bodies occupy the same camp; the courier remains exposed and recognizable at the center. |
| l4-tank | 8/10 | The tank fills the defended breach, rifle tracers cross the scene and soldiers/civilians still fight around it; the next-shot counter rather than a historical shot admits the capture. |
| l4-collapse | 8/10 | A huge hot orange fuel blast and flying remains behind the formerly safe stalls contrast with the small retreating force and the explicit fall-back subtitle; the courier is visible through the foreground stall reveal. |

No P0/P1 observed in the reviewed high-tier compositions. The portrait static photo crops are narrow; the low gameplay follow camera and low performance budgets have separate gates.

## Checklists A, D, G, H

| Item | Result | One-sentence justification |
| --- | --- | --- |
| A must: warm saturated palette | PASS | Peach paving, yellow/cream vehicles and orange fire retain the authored toy-town palette. |
| A must: soft tinted shadows | PASS | Tent, tree, soldier and bus shadows are blue-purple rather than black. |
| A must: emissive glow | PASS | Lamps/vehicle lights, brief muzzle flashes and the collapse fire show warm glow; the collapse sequence also shows the ground spill. |
| A must: high three-quarter camera | PASS | All four authored cameras preserve an elevated diorama view with little perspective distortion. |
| A should: chunky/beveled forms | PASS | Bus, tank, stalls, sandbags and character heads have clear broad toy-like masses. |
| A should: dense rounded foliage/flowers | FAIL | These military plaza crops contain little foliage, so this should item is not demonstrated by every photo. |
| A should: readable player/composition | PASS | The courier is visible at the authored anchor in each full-size frame, with the action outside the HUD panels. |
| A should: prop density | PASS | Tents, desks, queues, medkits, crates, sandbags, vehicles and retained bodies give the plaza a composed density. |
| D must: identify player in one second | PASS | Her cap/ponytail and compact armed silhouette are immediately located at the center of each authored anchor view, including through the revealed collapse stall. |
| D must: infected separated/eyes | PASS | The war Alpha and horde have infected facial cues and distinct shapes; the shared ordinary-infected and Alpha close views confirm red eyes independently of the wide army view. |
| D must: distinct attack telegraphs | PASS | The inherited current-base E07 move sequence supplies the distinct circle/cone/line cues; the campaign stills do not independently prove a complete attack. |
| D should: distinguish pickups/interactables | PASS | Red-cross medkits, lit supply items, desks and the camp's barriers separate from paving. |
| D should: VFX do not persistently obscure player | PASS | The collapse blast rises behind the stalls while the courier remains visible; the temporal E07/L4 sequences show its smoke developing rather than a persistent white screen. |
| G must: glow and visible spill | PASS | Current collapse fire lights the adjacent street and storefronts, corroborated by both-tier shared frame sequences. |
| G must: light respects geometry/hero shadows | PASS | Current props/characters cast grounded shadows; inherited current-base light/occlusion probes establish the dynamic-light geometry behavior. |
| G must: appropriate colored shadows | PASS | Soft blue-violet sunlight shadows remain visible on the warm plaza and tank approach. |
| G must: threats readable at night | PASS | These four L4 scenes are daylight, so the conditional night requirement does not apply; neither shadows nor the collapse haze erase the daylight threats. |
| G should: haze/glints without washout | PASS | Camp haze and muzzle glints remain subordinate to figures and vehicles. |
| G should: material reflections | PASS | Vehicle/window highlights distinguish paint and glass without an unrelated wet-road sheen on dry paving. |
| G should: scripted mood | PASS | The ordered golden refuge progresses into a lit, overrun war zone without changing districts. |
| H must: staged blast | PASS | Opened inherited high/low sequences explicitly show flash, expanding fireball, ring, debris and lingering smoke, including L4 collapse frames. |
| H must: physical consequence/scorch | PASS | The shared current-base sequence and raw motion receipts show moved props, bodies, cars and remaining scorch; current collapse additionally contains airborne remains. |
| H must: volumetric hot-to-cold fireball | PASS | Current collapse and inherited sequences show irregular yellow cores, orange lobes and cooler dark pockets rather than a flat card. |
| H must: lit wind-bent smoke/player read | PASS | The shared sequences show layered columns lit at their bases while the courier remains outside or silhouetted against them. |
| H should: car jump/parts/wreck | PASS | The inherited car sequence shows the car moving, detached parts and a burning wreck. |
| H should: flicker/embers/spill | PASS | Shared consecutive frames show changing fire shapes, embers and ground light, consistent with the current collapse still. |
| H should: class intensity | PASS | The shared medium and mega sequences differ substantially in radius and the current fuel blast appropriately dominates a rifle exchange. |

All applicable must items pass; 11/12 should items pass (91.7%). No gameplay tuning or corpse removal is part of this proof.
