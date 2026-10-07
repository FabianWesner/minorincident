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
