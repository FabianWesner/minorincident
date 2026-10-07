# E21 vision review

Status: **FAIL pending final orchestrator review**. The required stills are supplied; a still does not prove attack-telegraph animation readability. E21 remains `in-progress`.

Reviewed against `initial-drafts/sunset-grove-combat-gameplay-mockup.png`, the roadside gas-station/prop sheet and the Civic safe-zone sheet. Evidence is the four named 1600×900 spots on each route, matching Main Street W0/W2 stills, and `l3-phone-390.png` at 390×844. The applicable level checklists from `specs/90-test-concept.md` §7.1 are recorded below. The epic also names §7.5, which does not exist in the current test-concept document.

Side-by-side sheets in `compare/` cover each named photo spot against the reference, plus the identical-camera W0/W2 comparison. Each sheet is 1600×450, with a grid on the render side.

## A — Diorama look

| Item | Result | Reason |
| --- | --- | --- |
| Must: warm saturated palette | PASS | Warm paving, red vehicles, green lawns and pink foliage match the reference palette. |
| Must: soft tinted shadows | PASS | Street furniture and foliage cast purple shadows with softened edges. |
| Must: glowing emissives | PASS | Lamp lenses, windows and headlights visibly glow in the Main Street and checkpoint frames. |
| Must: high three-quarter camera | PASS | The isometric framing retains readable roads and little perspective distortion. |
| Should: chunky proportions | PASS | Cars, props and character heads retain the existing toy-like proportions. |
| Should: dense rounded foliage and flowers | PASS | Rounded pink crowns, shrubs and flower boxes fill the roadside planting strips. |
| Should: player size and composition | FAIL | Main Street and the phone follow view are clear, but the camp is crowded around the gate and its caption overlaps the tent foreground. |
| Should: reference-like prop density | PASS | Wrecks, benches, lamps, fences, barriers, cones and medical supplies give the scenes sufficient clutter. |

A passes every must and 3/4 should items (75%).

## D — Combat readability

| Item | Result | Reason |
| --- | --- | --- |
| Must: player identifiable within one second | PASS | The red-shirted survivor and teal backpack separate from the street, with the dog providing another location cue. |
| Must: infected separable; glowing eyes visible | PASS | Visible checkpoint infected have gray heads and red eye accents, while the Bloated silhouette is broader than the runners. |
| Must: attack telegraphs visible and distinct by shape | FAIL | These objective-entry stills do not establish the animation or distinct telegraph shapes; manual motion review is required. |
| Should: pickups and interactables distinct from clutter | PASS | Medical pickups, objective rings and door/gate markers use separate colors and shapes. |
| Should: VFX never conceal combat for more than brief moments | FAIL | A still cannot establish occlusion duration during a burst or melee sequence. |

D is not signed off. Follow-up: inspect a live checkpoint fight and Bloated burst during the orchestrator's vision review. Camp tent/caption occlusion also deserves review.

## E — W2 decay

| Item | Result | Reason |
| --- | --- | --- |
| Must: recognizably the same place | PASS | W0 and W2 retain the same fuel station, junction, planting, sidewalks and camera. |
| Must: higher tier obviously worse | PASS | W2 adds blood trails, emergency barriers, scattered bags, cones and abandoned vehicles. |
| Should: varied decay | PASS | Several prop types and blood decals convey the emergency rather than one repeated asset. |
| Should: level's time-of-day mood | PASS | Warm afternoon light matches L3's emergency-response setting. |

## F — HUD

| Item | Result | Reason |
| --- | --- | --- |
| Must: portrait/health, minimap, slot layout | PASS | Desktop frames show vitals top left, minimap top right and equipped cards bottom center; the phone uses the existing touch layout. |
| Must: selected side clearly indicated | PASS | The active bat card and phone LEFT action have a gold highlight. |
| Must: text legible at 1600×900 and 390×844 | PASS | Both views have readable objective/countdown text; the phone abbreviates the long objective using its existing expandable tracker. |
| Should: rounded panels, chunky bars and badges | PASS | The existing HUD styling follows those reference cues. |

## L3 scene evidence and remaining art

- `l3-mainstreet-w2-{market,park}.png`: barriers, cones, raised blood decals and scattered bags; compare with `l3-mainstreet-w0-{market,park}.png`.
- `l3-driving-{market,park}.png`: real sedan, tutorial infected and street clearance.
- `l3-checkpoint-{market,park}.png`: heavy wall, abandoned cars, emergency barriers and Bloated introduction.
- `l3-safe-zone-{market,park}.png`: registered `kit.evac-camp` / `npc.paramedic`, perimeter, turned patients and collapse caption.
- `l3-phone-390.png`: the actual portrait follow camera and visible 12:00 countdown.

`decay.dropped-belongings` remains missing; existing bags, benches, carts and medical coolers are the approved temporary dressing. The heavy wall uses the existing native E09 obstacle view. No new model was authored.
