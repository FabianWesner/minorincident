# E24 vision review

Reference: `initial-drafts/sunset-grove-combat-gameplay-mockup.png` (opened beside the L6 renders). The referenced `assets/_keyframes/lighting/` directory is absent in this checkout; the epic’s underground/night script and the shipped warm/cool camp fixtures provide the lighting reference. No reference asset was edited.

## Inspected Scene Lab sequences

Each contact sheet contains frames 0/60/120/180; full frame 90 was also opened.

| Scene | Score | Observations |
| --- | --- | --- |
| [Shelter injuries](scenes/qa-l6-shelter-injuries/sheet.jpg) | 7.5/10 | Warm lantern pools, mats, water stacks, resting/seated adults and the medic/patient pair read as an occupied refuge. The medic crouches beside the wrapped patient, while two standing adults face each other. Turnstiles and stairs identify the station. Courier mesh is fully above the platform. |
| [Tunnel retreat](scenes/qa-l6-tunnel-retreat/sheet.jpg) | 7.5/10 | Rails, repeated arch ribs, narrow walls and the packed adult group contrast with the open L1–L5 streets. Injury variants remain among the moving adults. The courier’s machine gun and lit silhouette remain identifiable. Arches occlude small parts of the crowd as expected; the courier has no missing limbs or floor penetration. |
| [Northgate night/fog](scenes/qa-l6-exit-night-weather/sheet.jpg) | 7/10 | Closed labeled gate, cracked raised street, crater, wreck, building edge, persistent orange fire and smoke distinguish the exterior. Cool fog and dark blue ground read as night. The courier and four adults stand above the street; the resting injured adult lies on its surface. The vehicle’s body/wheels are coherent at this camera. No actor/static piercing is reported. |

Clipping counters require interpretation: cropped tunnel kits contain rails, walls and supporting arches, so bounding-box actor-hit counts include the walkable track bed. The inspected full images show feet above the bed and no courier penetration. The exterior’s two static overlaps are authored building/dressing contacts; actor hits and piercing are zero.

## Checklist A — diorama look

| Item | Result | Reason |
| --- | --- | --- |
| Warm saturated palette [must] | PASS | Camp lanterns, colored supplies and adults retain warm accents under the specified cool underground/night lighting. |
| Soft tinted shadows [must] | PASS | Dark surfaces and shadows stay purple/blue rather than black. |
| Emissive bloom [must] | PASS | Lanterns, fluorescent strips, emergency lamps and fire have visible glow. |
| High three-quarter camera [must] | PASS | Station and tunnel views retain the established isometric composition; the exterior overview shows the finite street diorama. |
| Chunky proportions [should] | PASS | Shipped station kits, crates, adult models and vehicle keep the project’s toy proportions. |
| Rounded foliage [should] | N/A | This underground route and damaged street patch contain no garden. |
| Player scale/UI overlap [should] | PASS | The close sheet frames and physical straggler/chokepoint photographs expose the courier and routines; the injury captions remain legible. |
| Prop density [should] | PASS | Shelter supplies and tunnel rails/arches give distinct density; the night street is deliberately quiet. |

## Checklist D — combat readability

| Item | Result | Reason |
| --- | --- | --- |
| Player identifiable in one second [must] | PASS | Courier backpack, weapon silhouette and promoted light are immediately separable; actual mesh contrast measures 5.32:1 and 7.52:1. |
| Infected/background separation [must] | PASS | The actual readability captures record red eye maxima for all three sampled infected in both lighting states. |
| Distinguishable telegraphs [must] | PASS | The first-breach photograph shows the attacker’s raised-arm pose at the maintenance door; the standing adults and resting patients have clearly different silhouettes. |
| Interactables [should] | PASS | Gate leaf and neighboring brace crates are distinct from the rail bed and wall architecture. |
| VFX preserve silhouette [should] | PASS | Fire/smoke are away from the escaping group, and tunnel lighting leaves courier edges visible; brief muzzle glows do not remove the body silhouette. |

## Checklist G — lighting

| Item | Result | Reason |
| --- | --- | --- |
| Visible light spill [must] | PASS | Lanterns illuminate mats, red lamps tint tunnel walls and surface fire illuminates the adjacent street/building edge. |
| Geometry/shadows [must] | PASS | Flashlight is a promoted hero shadow caster; physical blockers and gate preserve sight and movement, and cropped frames show the courier’s grounded shadow. |
| Appropriate colored shadows [must] | PASS | Cool station/night shadows coexist with localized warm camps and fire. |
| Readable night [must] | PASS | Courier and adult silhouettes remain distinguishable on the dark street and in the emergency tunnel. |
| Haze/glints [should] | PASS | Surface fog and persistent fire smoke add depth without concealing the escaping people. |
| Reflections [should] | N/A | The authored exit is dry; no wet asphalt or large reflective water is present. |
| Scripted mood [should] | PASS | Shelter warmth gives way to red emergency pressure, then a cool quiet night exterior. |

## Final physical-input review

All seven physical-input photographs, the result and visible credits text were opened. The native machine-gun run rescues 28/29 in 261.77 s, with zero deaths and all four injured stragglers rejoined. One service gate is closed by physical `E`; the deterministic gate tests cover all three authored locations.

| Required story composition | Score | Inspected evidence |
| --- | --- | --- |
| Comparatively pleasant shelter | 7.5/10 | [Calm](real-l6-shelter-calm.png): warm occupied mats, resting and seated people, supplies, medic/patient and a readable ankle-wrap caption. |
| Shelter failing | 7/10 | [First breach](real-l6-first-breach.png), [power failure](real-l6-shelter-fails.png): maintenance-door attacker, gunfire through the occupied camp and red emergency spill. |
| Strong firepower, vulnerable group, confinement | 7/10 | [Wide retreat](real-l6-tunnel-retreat.png) includes the rear protector, the large group and the injured adult’s “My leg… I cannot keep up” caption; [chokepoint](real-l6-chokepoint.png) shows the crowded narrow gate and the rejoining offer of help. The close [straggler](real-l6-straggler.png) exposes the bandage and the grounded courier/corgi. Repeated arches and rails feel distinctly enclosed. |
| Above ground, night | 7/10 | [Northgate](real-l6-exit-night.png): gate, raised dry street, fog, wreck, crater and fire; the evacuated crowd and courier remain visible. |

No P0/P1 is visible on the courier, companion or vehicles in these captures. The wide tunnel overview makes people small, and the exit crowd is tightly packed; these are composition/crowding limitations. Close tunnel and Scene Lab frames show coherent limbs, grounded feet and intact vehicle wheels/body. The refreshed credits photograph shows the translated roll clear of the menu button after adding vertical spacing.
