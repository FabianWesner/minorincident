# E19 — L1 v2 vision checklist

## Decision

**AC23 pending Opus judgment.** These are the lane's observations, not the final ≥7/10 scores or an approval. The orchestrator explicitly reserved that judgment for Opus. E19 remains `in-progress`.

All nine latest merged-renderer images in `l1v2/`, plus the invitation image, were opened with the image-reading tool at 1600×900. They precede the final bicycle-only parking fix; recapture is deferred by the orchestrator’s wrap-up request. The route uses real clicks/interactions, with god mode only for visual setup. It does not reposition actors. The unassisted bicycle completion is a separate test and `unassisted-result.json`.

References were read without modification from the main checkout: `/Users/wesner/Workspace/minorincident/initial-drafts/l1v2-key-locations.png` and `sunset-grove-combat-gameplay-mockup.png`. They were supplied there during the lane run. Lighting keyframes remain unavailable. The stale AC23 reference to nonexistent §7.4 was corrected to the actual 90-test-concept §7.1 protocol. Final scores remain reserved for Opus.

## Required scenes

| Image | Observations | Score / final judgment |
| --- | --- | --- |
| [Morning](l1v2/l1-morning.png) | PASS: café, parked delivery bicycle, conversations, walking adults, gardens and more than eight visible pedestrians read as a living suburb. | Pending Opus |
| [Facility](l1v2/l1-facility.png) | PASS: medical sign, security fence, repeated warnings and the technician distinguish a guarded annex from a house. | Pending Opus |
| [Accident](l1v2/l1-accident.png) | PASS: damaged entrance/window, scattered glass and smoke are localized to the annex; the courier remains visible. Smoke obscures part of the sign. | Pending Opus |
| [Spread](l1v2/l1-spread.png) | PASS: the existing pedestrian is mid-transformation beside the sidewalk fence, retaining clothes/body; `spread-victim.json` records the same entity in its eye-glow phase. The camera observes the existing victim until that phase, without moving it. The raised camera exposes the victim, but the fence partly obscures the face. | Pending Opus |
| [Horde](l1v2/l1-horde.png) | PASS: multiple infected surround the courier with further threats at the garage; the group and minimap communicate pressure to run. Individual bodies overlap in the closest cluster. | Pending Opus |

Supplementary captures: [pickup](l1v2/l1-pickup.png), [escape](l1v2/l1-escape.png), [garage](l1v2/l1-garage.png), [safe](l1v2/l1-safe.png). Pickup shows the courier counter/hand-over; escape shows five released figures in differing postures/headings; garage shows the courier, opened/dithered structure and equipped bat; safe shows the bay and exact caption on the ordinary result panel after player-controlled entry; there is no ending fade. [Invitation](l1v2/firestation-invitation.png) is an additional pre-entry view for the PO change. The safe view is reversed to face the bay.

## Checklist A — diorama look

| Requirement | Result and reason |
| --- | --- |
| Must: warm saturated palette | PASS: orange light, teal accents, colored roofs and gardens avoid a default gray scene. |
| Must: soft tinted shadows | PASS: character and street shadows are visibly purple, with softened edges. |
| Must: emissive bloom | PASS: windows, café sign and street lamps glow. |
| Must: angle/FOV matches mockup | PASS: the images retain a high three-quarter angle with little perspective distortion; the full-scene captures frame a wider area than the close combat mockup. |
| Should: chunky/beveled proportions | PASS: vehicles, characters, benches and buildings have toy proportions and thick edges. |
| Should: dense rounded foliage and flowers | PASS: lawns, bushes, tree crowns and colorful borders fill the yards; some distant leaves are visibly angular. |
| Should: readable player, no UI overlap | FAIL: the spread framing centers the victim rather than the distant player, and horde bodies overlap; Opus must judge readability in the gameplay camera. |
| Should: clutter density matches reference | PASS: sidewalk furniture, signs, garden borders, parked vehicles and fences fill the same kinds of spaces as the location sheet, with less individual trim detail at distance. |

## Checklist D — combat readability

| Requirement | Result and reason |
| --- | --- |
| Must: player identified within one second | PASS in accident/escape/garage: courier colors and backpack separate it from the scene; FAIL in the tight horde cluster, where bodies overlap. |
| Must: infected separable, eyes visible | PASS: drained skin, hunched poses and glowing eyes distinguish nearby infected from the warm environment. |
| Must: attack telegraphs distinguishable | FAIL / unverified: still captures do not establish the complete timing/readability of attack telegraphs. |
| Should: pickups/interactables clear | PASS: objective markers, counter, rack, open garage and bay entrance distinguish interactions. |
| Should: VFX avoid persistent player occlusion | PASS for the captured accident: the plume remains over the annex and the courier is visible below it; duration needs motion review. |

## Checklist E — outbreak progression

| Requirement | Result and reason |
| --- | --- |
| Must: same place/layout | PASS: before/after annex images retain the fence, warning signs, rack and building. |
| Must: later state clearly worse | PASS: smoke, broken glass, transformed people and the chasing group change the calm suburb into an outbreak. |
| Should: varied deterioration | PASS: local building damage, individual transformation and crowd pressure are distinct changes. |
| Should: lighting matches level time | PASS: the warm daylight stays consistent through L1. |

## Review findings / handoff

No overall vision pass is claimed. Opus must score the five required scenes and decide whether any finding is P0/P1. Particular concerns: horde player/body overlap, strong opaque annex smoke, visible occlusion dithering at the garage/bay, reference fidelity after the shorter LOD distances, and sparse/bare yard areas in the morning view. The invitation also shows a pursuing infected overlapping the firefighter near the bay; the safe image has strong tree/occlusion dithering. The lane has not assigned those concerns final severities. The images and entity proof are ready for that review; static images cannot substitute for motion/attack-telegraph or human-feel assessment.

## Orchestrator (Opus) AC23 verdict — 2026-10-07
| Scene | Score | Finding |
|---|---|---|
| l1-morning | 8/10 | Living suburb: café, pedestrians, gardens, bikes. Some yards bare (P2). |
| l1-facility | 7/10 | Fence, warning signs, medical branding read "guarded annex". OK. |
| l1-accident | 7/10 | Contained damage, glass, smoke column; plume is opaque and covers the sign (P2). |
| l1-spread | 5/10 | **P1**: the mid-transformation victim is a tiny figure at the fence; the transformation does not read at the game camera (no clear stagger/colour shift/glow cue, face hidden by the fence). |
| l1-horde | 6/10 | **P1**: only a handful of infected visible near the player; it does not read "too many — run" (the minimap carries the message, the scene does not). Close bodies overlap. |
**AC23: FAIL** (two scenes < 7, two P1). E19 stays in-progress until fixed and re-reviewed.

## Lane l1-look — AC23 P1 fixes and re-capture (2026-10-07, pending Opus re-review)
Before images: `git show 51cbaffc:test-results/epics/E19/l1v2/l1-spread.png` / `l1-horde.png`. After: the files in `l1v2/` (all 9 spots re-captured by T-E19-23, 1600×900).

| Image | Change in the game | Lane observation | Score / final judgment |
| --- | --- | --- | --- |
| [Morning](l1v2/l1-morning.png) | none | Unchanged content; re-captured. | Pending Opus |
| [Facility](l1v2/l1-facility.png) | none | Unchanged content; re-captured. | Pending Opus |
| [Accident](l1v2/l1-accident.png) | none | Unchanged content; re-captured (plume still opaque, P2). | Pending Opus |
| [Spread](l1v2/l1-spread.png) | Turning pedestrians get a pulsing ash-green glow on the skin only (hair and clothes keep the person's own colours); ash-green wisps when the eyes ignite and a puff on rising (spec §5.7 "VFX puff"). Capture: the first systemic victim on open ground (no fence/hedge/tree/lamp/wall on the camera side), photographed mid-rise with the **game follow camera** angle at zoom 0.75 (player range 0.5–1.45), centred on the victim. | The same jogger (dreadlocks, red/white top, own clothes) is half-risen on the sidewalk with glowing ash-green hands/face and green wisps; `spread-victim.json` = same entity id in phase `rise`, `openGround: true`. The face is turned away from the camera in this seed, so the red eyes are not readable. | Pending Opus |
| [Horde](l1v2/l1-horde.png) | Beat 9 starts when the courier steps out of the garage with the bat; the director tops the garage group up to 20 (was 6) from house doors spread by bearing (W, N, E doors; ≤ 3 per door, doors opening 0.4 s apart) and they rush to where the courier is; route streams 4 (was 3). Infected keep a 0.22 m air gap among themselves (was 0.015). Capture: game camera at its widest zoom (1.45) once ≥ 12 infected are within 16 m, instead of after 20 s of piling onto the immortal courier. | ~12 infected visible converging from up-left, up and right onto the courier on Elm Street, individual bodies separable; `horde-scene.json`: 17 within 16 m, 21 within 25 m, 0 within 2 m, bearings spread over the full circle. | Pending Opus |

Fairness/perf after the change: complete bot 20/20 (median 102.6 s, 0 deaths), newbie 20/20 (median 119.6 s, median deaths 0), evade-only completes, T-E19-09 (AC25 ≥ 6 near the garage, door emergence) green. Horde perf (30 forced infected, high tier, machine load ~9): A/B on the same load, before 15.3 ms p95, after 14.7 / 15.1 ms p95 (budget 16.7 ms); the earlier 14.1 ms reading was on a quieter machine.

## Orchestrator (Opus) AC23 re-review — 2026-10-07
l1-spread 7/10 (same jogger in own clothes, ash-green skin glow and wisps mid-rise, readable at the game camera; face turned away this seed — P2). l1-horde 7/10 (~12 infected converging on the courier from three directions, separable bodies; a foreground roof covers part of the frame — P2). Morning 8, facility 7, accident 7 unchanged. **AC23: PASS** (all ≥ 7, no P0/P1).
